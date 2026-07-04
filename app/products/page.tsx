import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { productSlug } from "@/lib/slug";
import { supabase } from "@/lib/supabase";
import { requiresInquiry } from "@/lib/price";
import { getActiveEventPrices } from "@/lib/active-event-prices";
import { FilterSidebar } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";
import { ProductCardImage } from "./ProductCardImage";

/** Format a card price; $25k+ items show "Inquire for Pricing". */
function fmtCardPrice(price: number): string {
  return requiresInquiry(price) ? "Inquire for Pricing" : `$${price.toFixed(2)}`;
}
/** Build a range label, obfuscating if either bound is high-value. */
function fmtRangeLabel(min: number, max: number): string {
  return `${fmtCardPrice(min)} – ${fmtCardPrice(max)}`;
}

interface ProductCard {
  id: string;
  name: string;
  category: string;
  origin: string;
  images: string[];
  color: string[] | null;
  tier: string[];
  size: number;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  show_price: boolean;
  description: string | null;
  is_featured: boolean;
  is_clearance: boolean;
  is_published: boolean;
  quick_ship: boolean;
  status: string;
  slug: string;
  public_id: string;
  renewed_at: string | null;
  created_at: string;
}

interface CountRow {
  category: string;
  status: string;
  is_clearance: boolean;
  origin: string | null;
  color: string[] | null;
  quick_ship: boolean;
}

interface OptionPriceRow {
  product_id: string;
  price_usd: number | null;
  sale_price_usd: number | null;
  status: string;
}

const ORIGIN_TEXT: Record<string, string> = {
  Myanmar: "text-emerald-600 dark:text-emerald-400",
  Guatemala: "text-blue-600 dark:text-blue-400",
};

const COLOR_SWATCHES: Record<string, string> = {
  white: "bg-white border border-gray-300",
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  pink: "bg-pink-400",
  lavender: "bg-purple-300",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  black: "bg-gray-900",
  gray: "bg-gray-400",
  clear: "bg-gradient-to-br from-white via-gray-100 to-white border border-gray-300",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

import { getCategoryLabel } from "./categories";
import { ProductCardLink } from "./ProductCardLink";

export const revalidate = 120;

const PRODUCT_LIST_SELECT = "id, name, category, origin, color, tier, size, price_display_usd, sale_price_usd, show_price, is_featured, is_clearance, status, slug, public_id, is_published, quick_ship, renewed_at, created_at";
const PRODUCT_CARD_SELECT = `${PRODUCT_LIST_SELECT}, images, description`;
const PAGE_SIZE = 18;

export type ProductSearchParams = {
  colors?: string;
  status?: string;
  category?: string;
  origins?: string;
  minSize?: string;
  maxSize?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  shipping?: string;
  search?: string;
  clearance?: string;
};

export type ProductListingIntro = {
  eyebrow?: string;
  title: string;
  description: string;
  breadcrumbs?: { label: string; href?: string }[];
};

const getCachedCountData = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("products")
      .select("category, status, is_clearance, origin, color, quick_ship")
      .eq("is_published", true)
      .limit(10000)
      .returns<CountRow[]>();
    return data ?? [];
  },
  ["products-count-data-v1"],
  { revalidate: 120 }
);

export async function ProductListing({
  searchParams,
  baseParams = {},
  intro,
  pathname = "/products",
}: {
  searchParams: Promise<ProductSearchParams>;
  baseParams?: ProductSearchParams;
  intro?: ProductListingIntro;
  pathname?: string;
}) {
  const urlParams = await searchParams;
  const params = { ...baseParams, ...urlParams };
  const selectedColors = params.colors?.split(",").filter(Boolean) ?? [];
  const selectedStatuses = params.status?.split(",").filter(Boolean) ?? [];
  const selectedOrigins = params.origins?.split(",").filter(Boolean) ?? [];
  const selectedShipping = params.shipping?.split(",").filter(Boolean) ?? [];
  const filterClearance = params.clearance === "1";
  const selectedCategories = params.category ? params.category.split(",").filter(Boolean) : [];
  const searchQuery = params.search?.trim() ?? "";
  const minSize = params.minSize ? Number(params.minSize) : null;
  const maxSize = params.maxSize ? Number(params.maxSize) : null;
  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  const sort = params.sort ?? "";
  const currentPage = Math.max(1, Number(params.page ?? "1"));

  const isDev = process.env.NODE_ENV === "development";

  // Query A — sidebar counts (lightweight, cached)
  const countData = await getCachedCountData();

  // Compute counts from the lightweight rows scoped to the selected category.
  const countBase = selectedCategories.length > 0
    ? countData.filter((p) => selectedCategories.includes(p.category))
    : countData;
  const statusCounts: Record<string, number> = {};
  const originCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  const shippingCounts: Record<string, number> = {};
  let clearanceCount = 0;
  for (const p of countBase) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    if (p.is_clearance) clearanceCount++;
    if (p.origin) originCounts[p.origin] = (originCounts[p.origin] ?? 0) + 1;
    for (const c of p.color ?? []) {
      if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
    const shipKey = p.quick_ship ? "ship_now" : "standard";
    shippingCounts[shipKey] = (shippingCounts[shipKey] ?? 0) + 1;
  }

  // Query B — paginated product display with all filters pushed to the DB
  let q: any = supabase.from("products").select(PRODUCT_CARD_SELECT, { count: "exact" });

  // Published filter
  if (!isDev) {
    q = q.eq("is_published", true);
  }

  // Category filter
  if (selectedCategories.length > 0) {
    q = q.in("category", selectedCategories);
  }

  // Status filter — "available" also includes "on_sale"
  if (selectedStatuses.length > 0) {
    const dbStatuses = [...selectedStatuses];
    if (selectedStatuses.includes("available") && !dbStatuses.includes("on_sale")) {
      dbStatuses.push("on_sale");
    }
    q = q.in("status", dbStatuses);
  }

  // Shipping filter
  if (selectedShipping.length === 1) {
    if (selectedShipping[0] === "ship_now") {
      q = q.eq("quick_ship", true);
    } else if (selectedShipping[0] === "standard") {
      q = q.eq("quick_ship", false);
    }
  }
  // if both or neither are selected — no filter

  // Clearance filter
  if (filterClearance) {
    q = q.eq("is_clearance", true);
  }

  // Origin filter
  if (selectedOrigins.length > 0) {
    q = q.in("origin", selectedOrigins);
  }

  // Color filter — product must overlap with selected colors
  if (selectedColors.length > 0) {
    q = q.overlaps("color", selectedColors);
  }

  // Size filter
  if (minSize !== null) {
    q = q.gte("size", minSize);
  }
  if (maxSize !== null) {
    q = q.lte("size", maxSize);
  }

  // Search filter
  if (searchQuery) {
    q = q.ilike("name", `%${searchQuery}%`);
  }

  // Price filter
  if (minPrice !== null) {
    q = q.or(`price_display_usd.gte.${minPrice},sale_price_usd.gte.${minPrice}`);
  }
  if (maxPrice !== null) {
    q = q.or(`price_display_usd.lte.${maxPrice},sale_price_usd.lte.${maxPrice}`);
  }

  // Sort
  if (sort === "price_asc") {
    q = q.order("price_display_usd", { ascending: true, nullsFirst: false });
  } else if (sort === "price_desc") {
    q = q.order("price_display_usd", { ascending: false, nullsFirst: false });
  } else if (sort === "size_asc") {
    q = q.order("size", { ascending: true, nullsFirst: false });
  } else if (sort === "size_desc") {
    q = q.order("size", { ascending: false, nullsFirst: true });
  } else {
    // "newest", "featured", or default — sort by COALESCE(renewed_at, created_at)
    q = q.order("effective_date", { ascending: false });
  }

  // Pagination range
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  q = q.range(from, to);

  const { data: rawData, count: rawCount, error } = await q;
  const pageProducts = (rawData ?? []) as unknown as ProductCard[];
  const totalCount = rawCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  // Defensive: clamp an out-of-range page to the last valid page
  if (totalCount > 0 && totalPages > 0 && currentPage > totalPages) {
    const redirectParams = new URLSearchParams(
      Object.entries(urlParams).filter((e): e is [string, string] => e[1] != null)
    );
    if (totalPages <= 1) redirectParams.delete("page");
    else redirectParams.set("page", String(totalPages));
    redirect(`${pathname}?${redirectParams.toString()}`);
  }

  if (error) {
    console.error("Failed to load products:", error);
  }

  // Options and event prices — only for the current page's products
  const pageIds = pageProducts.map((p) => p.id);
  const [visOptResult, pageEventPrices] = pageIds.length > 0
    ? await Promise.all([
        supabase
          .from("product_options")
          .select("product_id, price_usd, sale_price_usd, status")
          .in("product_id", pageIds),
        getActiveEventPrices(pageIds),
      ])
    : [{ data: [] as OptionPriceRow[] }, new Map<string, { computedBasePrice: number; campaignName: string }>()];

  const optionMap = new Map<string, OptionPriceRow[]>();
  for (const opt of (visOptResult.data ?? []) as OptionPriceRow[]) {
    const arr = optionMap.get(opt.product_id) ?? [];
    arr.push(opt);
    optionMap.set(opt.product_id, arr);
  }

  const eventPrices = pageEventPrices;

  // Get effective available-option prices for a product.
  // Uses sale_price_usd when set, otherwise price_usd, falling back to product.price_display_usd.
  function getVariantPrices(p: ProductCard): number[] {
    const opts = optionMap.get(p.id) ?? [];
    const available = opts.filter((o) => o.status !== "sold");
    const pool = available.length > 0 ? available : opts; // if all sold, still compute range
    return pool
      .map((o) => o.sale_price_usd ?? o.price_usd ?? p.price_display_usd)
      .filter((v): v is number => v != null);
  }

  const paginatedWithImages = pageProducts.map((p) => ({
    ...p,
    images: (p.images ?? []).slice(0, 2).filter(Boolean),
  }));

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16">
      {intro?.breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
          {intro.breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-2">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-600 dark:text-gray-300">{crumb.label}</span>
              )}
              {i < intro.breadcrumbs!.length - 1 && <span className="text-gray-300 dark:text-gray-700">/</span>}
            </span>
          ))}
        </nav>
      )}

      {intro?.eyebrow && (
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400 mb-3">
          {intro.eyebrow}
        </p>
      )}
      <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
        {intro?.title ?? "Our Collection"}
      </h1>
      {searchQuery ? (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs sm:text-base text-gray-500 dark:text-gray-400">
            Search results for <span className="font-medium text-gray-800 dark:text-gray-200">&quot;{searchQuery}&quot;</span> · {totalCount} {totalCount === 1 ? "item" : "items"} found
          </p>
          <a
            href={pathname}
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear
          </a>
        </div>
      ) : (
        <p className="text-xs sm:text-base mt-3 max-w-2xl leading-relaxed text-gray-500 dark:text-gray-400">
          {intro?.description ?? "Browse our collection of authentic jade pieces."}
        </p>
      )}

      <div className="mt-10 flex gap-6">
        {/* Filter sidebar — manages its own internal Suspense for URL sync */}
        <FilterSidebar
          statusCounts={statusCounts}
          originCounts={originCounts}
          colorCounts={colorCounts}
          shippingCounts={shippingCounts}
          clearanceCount={clearanceCount}
          initialColors={selectedColors}
          initialStatuses={selectedStatuses}
          initialOrigins={selectedOrigins}
          initialShipping={selectedShipping}
          initialClearance={filterClearance}
          initialMinSize={params.minSize ?? ""}
          initialMaxSize={params.maxSize ?? ""}
          initialMinPrice={params.minPrice ?? ""}
          initialMaxPrice={params.maxPrice ?? ""}
        />

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] sm:text-sm text-gray-400 dark:text-gray-500">
              {totalCount} {totalCount === 1 ? "item" : "items"}
              {totalPages > 1 && <span className="ml-1">· page {safePage} of {totalPages}</span>}
            </p>
            <SortSelect initialSort={sort} />
          </div>
          {totalCount === 0 ? (
            <p className="text-gray-400 dark:text-gray-600">
              No products match your filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedWithImages.map((product, i) => (
                <ProductCardLink
                  key={product.id}
                  href={`/products/${productSlug(product)}`}
                  className={`group rounded-2xl overflow-hidden transition-all duration-500 block ${product.status === "sold"
                    ? "bg-gray-100 dark:bg-gray-800/60 shadow-sm"
                    : "bg-white dark:bg-gray-900 shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.13)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] hover:-translate-y-1"
                    }`}
                >
                  {/* Image strip */}
                  <ProductCardImage images={product.images ?? []} name={product.name} priority={i < 2}>
                    {product.status === "sold" && (
                      <div className="absolute inset-0 bg-black/45 z-10 pointer-events-none" />
                    )}
                    {isDev && !product.is_published && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 bg-gray-600/90 backdrop-blur-sm text-white text-[10px] sm:text-[14px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-full">
                        Draft
                      </div>
                    )}
                    {/* Left badge strip — sold + clearance can coexist */}
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex flex-col gap-1">
                      {product.status === "sold" && (
                        <div className="ProductCard_Badge_Sold self-start bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-gray-500 dark:text-gray-400 text-[10px] sm:text-[14px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full">
                          Sold
                        </div>
                      )}
                      {product.is_clearance && (
                        <div className="ProductCard_Badge_Clearance self-start bg-amber-800/85 backdrop-blur-sm text-amber-100 text-[10px] sm:text-[13px] font-semibold uppercase tracking-widest px-2.5 py-1">
                          Clearance
                        </div>
                      )}
                      {product.status !== "sold" && (() => {
                        const eventEntry = eventPrices.get(product.id);
                        if (eventEntry) {
                          return (
                            <div className="self-start bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] sm:text-[14px] font-semibold uppercase tracking-widest px-2.5 py-1">
                              {eventEntry.campaignName}
                            </div>
                          );
                        }
                        if (product.status === "on_sale") {
                          return (
                            <div className="ProductCard_Badge_OnSale self-start flex items-center gap-1.5">
                              <div className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] sm:text-[14px] font-semibold tracking-wide px-2.5 py-1">
                                Sale
                              </div>
                              {product.show_price && product.price_display_usd != null && product.sale_price_usd != null && (
                                <div className="bg-amber-500/90 backdrop-blur-sm text-white text-[10px] sm:text-[14px] font-semibold tracking-wide px-2.5 py-1 rounded-full">
                                  −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {product.quick_ship && product.status !== "sold" && (
                      <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10">
                        <div
                          className="flex items-center gap-1 sm:gap-1.5 bg-sky-950/90 backdrop-blur-sm border border-sky-400/40 text-sky-300 text-[10px] sm:text-[14px] font-medium tracking-wide px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                          style={{ boxShadow: "0 0 10px 1px rgba(56,189,248,0.25)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                          Ship Now
                        </div>
                      </div>
                    )}
                  </ProductCardImage>

                  {/* Info — desktop */}
                  <div className={`ProductCard_InfoDesktop hidden sm:block px-5 pt-4 pb-5 ${product.status === "sold" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="ProductCard_Category text-[14px] font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                        {getCategoryLabel(product.category)}
                      </span>
                      {product.tier?.length > 0 && (
                        <span className="ProductCard_Tier text-[14px] text-gray-300 dark:text-gray-600">·</span>
                      )}
                      {product.tier?.length > 0 && (
                        <span className="ProductCard_Tier text-[14px] text-gray-400 dark:text-gray-500 italic">{product.tier.join(" · ")}</span>
                      )}
                    </div>
                    <h2 className="ProductCard_Title text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                    {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                      <div className="ProductCard_ColorTags mt-2.5 flex flex-wrap gap-1.5">
                        {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1.5 text-[15px] text-gray-500 dark:text-gray-400">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`ProductCard_PriceRow mt-3 pt-3 border-t dark:border-gray-800 flex items-center justify-between ${product.status === "sold" ? "border-gray-200" : "border-gray-100"}`}>
                      {(() => {
                        // Only expose prices to the browser when show_price is true
                        const vp = product.show_price ? getVariantPrices(product) : [];
                        const dp = product.show_price ? product.price_display_usd : null;
                        const sp = product.show_price ? product.sale_price_usd : null;
                        const ev = product.show_price ? (eventPrices.get(product.id)?.computedBasePrice ?? null) : null;
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const hasRange = vMin != null && vMax != null && vMin !== vMax;
                        const rangeLabel = hasRange ? fmtRangeLabel(vMin!, vMax!) : null;
                        if (product.status === "sold") {
                          const base = sp ?? (rangeLabel ? null : dp);
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-[17px] text-gray-400 dark:text-gray-500">
                                {base != null ? fmtCardPrice(base) : rangeLabel ?? "—"}
                              </span>
                              {sp != null && dp != null && (
                                <span className="text-[15px] text-gray-300 dark:text-gray-600 line-through">{fmtCardPrice(dp)}</span>
                              )}
                            </span>
                          );
                        }
                        if (ev != null && !requiresInquiry(ev)) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-[17px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(ev)}</span>
                              <span className="text-[15px] text-gray-300 dark:text-gray-600 line-through">
                                {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : null)}
                              </span>
                            </span>
                          );
                        }
                        if ((product.status === "on_sale" || product.is_clearance) && sp != null) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-[17px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(sp)}</span>
                              <span className="text-[15px] text-gray-300 dark:text-gray-600 line-through">
                                {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : null)}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-[17px] font-semibold text-gray-800 dark:text-gray-200">
                            {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : "Inquire for Pricing")}
                          </span>
                        );
                      })()}
                      <span className="ProductCard_SizeOrigin text-[15px] text-gray-400 dark:text-gray-500 text-right">
                        {product.size ? `${product.size}mm` : ""}
                        {product.size && product.origin ? " · " : ""}
                        {product.origin && <span className={ORIGIN_TEXT[product.origin] ?? ""}>{product.origin}</span>}
                      </span>
                    </div>
                  </div>

                  {/* Info — mobile */}
                  <div className={`ProductCard_InfoMobile sm:hidden px-2 pt-3 pb-3.5 flex flex-col gap-1 ${product.status === "sold" ? "opacity-70" : ""}`}>
                    <span className="ProductCard_Category text-[8px] font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">{getCategoryLabel(product.category)}</span>
                    {product.tier?.length > 0 && (
                      <span className="ProductCard_Tier text-[8px] text-gray-400 dark:text-gray-500 italic">{product.tier.join(" · ")}</span>
                    )}
                    <h2 className="ProductCard_Title text-[10px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                    {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                      <div className="ProductCard_ColorTags flex flex-wrap gap-x-2 gap-y-1 mt-0.5">
                        {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 text-[8px] text-gray-500 dark:text-gray-400">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`ProductCard_PriceRow mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between ${product.status === "sold" ? "border-gray-200" : "border-gray-100"}`}>
                      {(() => {
                        const vp = product.show_price ? getVariantPrices(product) : [];
                        const dp = product.show_price ? product.price_display_usd : null;
                        const sp = product.show_price ? product.sale_price_usd : null;
                        const ev = product.show_price ? (eventPrices.get(product.id)?.computedBasePrice ?? null) : null;
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const hasRange = vMin != null && vMax != null && vMin !== vMax;
                        const rangeLabel = hasRange ? fmtRangeLabel(vMin!, vMax!) : null;
                        if (product.status === "sold") {
                          const base = sp ?? (rangeLabel ? null : dp);
                          return (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {base != null ? fmtCardPrice(base) : rangeLabel ?? "—"}
                            </span>
                          );
                        }
                        if (ev != null && !requiresInquiry(ev)) {
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(ev)}</span>
                              <span className="text-[8px] text-gray-300 dark:text-gray-600 line-through">
                                {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : null)}
                              </span>
                            </span>
                          );
                        }
                        if ((product.status === "on_sale" || product.is_clearance) && sp != null) {
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(sp)}</span>
                              <span className="text-[8px] text-gray-300 dark:text-gray-600 line-through">
                                {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : null)}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">
                            {rangeLabel ?? (dp != null ? fmtCardPrice(dp) : "Inquire for Pricing")}
                          </span>
                        );
                      })()}
                      {(product.size || product.origin) && (
                        <span className="ProductCard_SizeOrigin text-[7px] text-gray-400 dark:text-gray-500">
                          {product.size ? `${product.size}mm` : ""}
                          {product.size && product.origin ? " · " : ""}
                          {product.origin && <span className={ORIGIN_TEXT[product.origin] ?? ""}>{product.origin}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </ProductCardLink>
              ))}
            </div>
          )}
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            searchString={new URLSearchParams(
              Object.entries({
                ...(urlParams.colors ? { colors: urlParams.colors } : {}),
                ...(urlParams.status ? { status: urlParams.status } : {}),
                ...(urlParams.category ? { category: urlParams.category } : {}),
                ...(urlParams.origins ? { origins: urlParams.origins } : {}),
                ...(urlParams.clearance ? { clearance: urlParams.clearance } : {}),
                ...(urlParams.shipping ? { shipping: urlParams.shipping } : {}),
                ...(urlParams.minSize ? { minSize: urlParams.minSize } : {}),
                ...(urlParams.maxSize ? { maxSize: urlParams.maxSize } : {}),
                ...(urlParams.minPrice ? { minPrice: urlParams.minPrice } : {}),
                ...(urlParams.maxPrice ? { maxPrice: urlParams.maxPrice } : {}),
                ...(urlParams.sort ? { sort: urlParams.sort } : {}),
                ...(urlParams.search ? { search: urlParams.search } : {}),
              })
            ).toString()}
            pathname={pathname}
          />
        </div>
      </div>
    </div>
  );
}

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<ProductSearchParams>;
}) {
  return <ProductListing searchParams={searchParams} />;
}
