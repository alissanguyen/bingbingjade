import { Suspense } from "react";
import { productSlug } from "@/lib/slug";
import { supabase } from "@/lib/supabase";
import { resolveImageUrls, isStoragePath } from "@/lib/storage";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import { FilterSidebar } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";
import { ProductCardImage } from "./ProductCardImage";

/** Format a card price, obfuscating high-value amounts. */
function fmtCardPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
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
  description: string | null;
  is_featured: boolean;
  is_published: boolean;
  quick_ship: boolean;
  status: string;
  slug: string;
  public_id: string;
}

interface OptionPriceRow {
  product_id: string;
  price_usd: number | null;
  sale_price_usd: number | null;
  status: string;
}

const ORIGIN_TEXT: Record<string, string> = {
  Myanmar:   "text-emerald-600 dark:text-emerald-400",
  Guatemala: "text-blue-600 dark:text-blue-400",
  Hetian:    "text-fuchsia-600 dark:text-fuchsia-400",
};

const COLOR_SWATCHES: Record<string, string> = {
  white:    "bg-white border border-gray-300",
  green:    "bg-green-500",
  blue:     "bg-blue-500",
  red:      "bg-red-500",
  pink:     "bg-pink-400",
  purple:   "bg-purple-500",
  orange:   "bg-orange-500",
  yellow:   "bg-yellow-400",
  black:    "bg-gray-900",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

import { getCategoryLabel } from "./categories";
import { ProductCardLink } from "./ProductCardLink";

export const revalidate = 21600;

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<{ colors?: string; status?: string; category?: string; origins?: string; minSize?: string; maxSize?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const selectedColors   = params.colors?.split(",").filter(Boolean) ?? [];
  const selectedStatuses = params.status?.split(",").filter(Boolean) ?? [];
  const selectedOrigins  = params.origins?.split(",").filter(Boolean) ?? [];
  const selectedCategory = params.category ?? "";
  const minSize = params.minSize ? Number(params.minSize) : null;
  const maxSize = params.maxSize ? Number(params.maxSize) : null;
  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  const sort = params.sort ?? "";
  const PAGE_SIZE = 18;
  const currentPage = Math.max(1, Number(params.page ?? "1"));

  const isDev = process.env.NODE_ENV === "development";

  const productsQuery = supabase
    .from("products")
    .select("id, name, category, origin, images, color, tier, size, price_display_usd, sale_price_usd, description, is_featured, status, slug, public_id, is_published, quick_ship")
    .order("created_at", { ascending: false });

  if (!isDev) productsQuery.eq("is_published", true);

  const [{ data: allProducts, error }, { data: allOptions }] = await Promise.all([
    productsQuery,
    supabase
      .from("product_options")
      .select("product_id, price_usd, sale_price_usd, status")
      .returns<OptionPriceRow[]>(),
  ]);

  if (error) {
    console.error("Failed to load products:", error.message);
  }

  // Build option map: productId → options[]
  const optionMap = new Map<string, OptionPriceRow[]>();
  for (const opt of allOptions ?? []) {
    const arr = optionMap.get(opt.product_id) ?? [];
    arr.push(opt);
    optionMap.set(opt.product_id, arr);
  }

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

  // Effective sort price: for on_sale products use sale price; otherwise use min variant / display price
  function effectiveSortPrice(p: ProductCard): number {
    if (p.status === "on_sale" && p.sale_price_usd != null) return p.sale_price_usd;
    const vp = getVariantPrices(p);
    return vp.length > 0 ? Math.min(...vp) : (p.price_display_usd ?? Infinity);
  }

  const products = (allProducts as ProductCard[] | null)?.filter((p) => {
    // Category filter
    if (selectedCategory && p.category !== selectedCategory) return false;
    // Status filter — "available" also matches "on_sale" products
    if (selectedStatuses.length > 0) {
      const effectiveStatus = selectedStatuses.includes("available") && p.status === "on_sale"
        ? "available"
        : p.status;
      if (!selectedStatuses.includes(effectiveStatus)) return false;
    }
    // Origin filter
    if (selectedOrigins.length > 0 && !selectedOrigins.includes(p.origin)) return false;
    // Color filter — product must have at least one of the selected colors
    if (selectedColors.length > 0) {
      const productColors = p.color ?? [];
      if (!selectedColors.some((c) => productColors.includes(c))) return false;
    }
    // Size filter
    if (minSize !== null && (p.size == null || p.size < minSize)) return false;
    if (maxSize !== null && (p.size == null || p.size > maxSize)) return false;
    // Price filter — match if any available variant price overlaps the filter range
    if (minPrice !== null || maxPrice !== null) {
      const effectivePrice =
        p.status === "on_sale" && p.sale_price_usd != null ? p.sale_price_usd : null;
      const vPrices = getVariantPrices(p);
      if (vPrices.length > 0) {
        const vMin = Math.min(...vPrices);
        const vMax = Math.max(...vPrices);
        const checkMin = effectivePrice ?? vMin;
        const checkMax = effectivePrice ?? vMax;
        if (minPrice !== null && checkMax < minPrice) return false;
        if (maxPrice !== null && checkMin > maxPrice) return false;
      } else {
        const ep = p.status === "on_sale" && p.sale_price_usd != null ? p.sale_price_usd : p.price_display_usd;
        if (minPrice !== null && (ep == null || ep < minPrice)) return false;
        if (maxPrice !== null && (ep == null || ep > maxPrice)) return false;
      }
    }
    return true;
  }) ?? [];

  // Sort
  if (sort) {
    products.sort((a, b) => {
      if (sort === "price_asc" || sort === "price_desc") {
        const pa = effectiveSortPrice(a);
        const pb = effectiveSortPrice(b);
        return sort === "price_asc" ? pa - pb : pb - pa;
      }
      if (sort === "size_asc" || sort === "size_desc") {
        const sa = a.size ?? Infinity;
        const sb = b.size ?? Infinity;
        return sort === "size_asc" ? sa - sb : sb - sa;
      }
      return 0;
    });
  }

  // Compute counts from the full unfiltered product list for the filter sidebar
  const allProductsList = (allProducts as ProductCard[] | null) ?? [];
  const statusCounts: Record<string, number> = {};
  const originCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  for (const p of allProductsList) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    if (p.origin) originCounts[p.origin] = (originCounts[p.origin] ?? 0) + 1;
    for (const c of p.color ?? []) {
      if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }

  const totalCount = products.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginated = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Resolve public URLs for the first two images of each paginated product
  // (ProductCardImage uses images[0] and images[1] for the hover slide effect).
  // Only include non-empty paths so that single-image products don't get a
  // malformed URL injected as images[1], which would falsely enable peek animation.
  const firstTwoPaths = paginated.flatMap((p) => [p.images?.[0] ?? "", p.images?.[1] ?? ""]);
  const resolvedFirstTwo = await resolveImageUrls(firstTwoPaths);
  const paginatedWithImages = paginated.map((p, i) => {
    const raw0 = firstTwoPaths[i * 2];
    const raw1 = firstTwoPaths[i * 2 + 1];
    const r0 = raw0 ? resolvedFirstTwo[i * 2] : "";
    const r1 = raw1 ? resolvedFirstTwo[i * 2 + 1] : "";
    const rest = p.images?.slice(2) ?? [];
    return {
      ...p,
      images: [r0, r1, ...rest].filter(Boolean),
    };
  });

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Browse our collection of authentic jade pieces.</p>

      <div className="mt-10 flex gap-6">
        {/* Filter sidebar — manages its own internal Suspense for URL sync */}
        <FilterSidebar
          statusCounts={statusCounts}
          originCounts={originCounts}
          colorCounts={colorCounts}
          initialColors={selectedColors}
          initialStatuses={selectedStatuses}
          initialOrigins={selectedOrigins}
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
          {products.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600">
              No products match your filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedWithImages.map((product, i) => (
                <ProductCardLink
                  key={product.id}
                  href={`/products/${productSlug(product)}`}
                  className={`group rounded-2xl border overflow-hidden hover:shadow-lg transition-all block ${
                    product.status === "sold"
                      ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
                  }`}
                >
                  {/* Image strip — slides to peek at second image on hover/touch */}
                  <ProductCardImage images={product.images ?? []} name={product.name} priority={i === 0}>
                    {isDev && !product.is_published && (
                      <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-10 bg-gray-600 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                        Draft
                      </div>
                    )}
                    {product.status === "sold" && (
                      <div className="ProductCard_Badge_Sold absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 bg-black text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                        Sold
                      </div>
                    )}
                    {product.status === "on_sale" && (
                      <div className="ProductCard_Badge_OnSale absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5">
                        <div className="bg-amber-400 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                          On Sale
                        </div>
                        {product.price_display_usd != null && product.sale_price_usd != null && (
                          <div className="bg-orange-500 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                            −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                          </div>
                        )}
                      </div>
                    )}
                    {product.quick_ship && product.status !== "sold" && (
                      <div className="absolute bottom-1.5 left-1.5 sm:bottom-2.5 sm:left-2.5 z-10">
                        <div
                          className="flex items-center gap-1 sm:gap-1.5 bg-sky-950 border border-sky-400/60 text-sky-300 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                          style={{ boxShadow: "0 0 8px 1px rgba(56,189,248,0.35)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                          Ships Now
                        </div>
                      </div>
                    )}
                  </ProductCardImage>

                  {/* Info — desktop */}
                  <div className={`ProductCard_InfoDesktop hidden sm:block p-4 ${product.status === "sold" ? "opacity-80" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="ProductCard_Category text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {getCategoryLabel(product.category)}
                      </span>
                      {product.tier?.length > 0 && (
                        <span className="ProductCard_Tier text-xs text-gray-400 dark:text-gray-500">· {product.tier.join(" · ")}</span>
                      )}
                    </div>
                    <h2 className="ProductCard_Title font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                    <p className="ProductCard_Description mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{product.description}</p>
                    {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                      <div className="ProductCard_ColorTags mt-3 flex flex-wrap gap-1.5">
                        {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ProductCard_PriceRow mt-3 flex items-center justify-between">
                      {(() => {
                        const vp = getVariantPrices(product);
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const hasRange = vMin != null && vMax != null && vMin !== vMax;
                        const rangeLabel = hasRange ? fmtRangeLabel(vMin!, vMax!) : null;
                        if (product.status === "sold") {
                          const base = product.sale_price_usd ?? (rangeLabel ? null : product.price_display_usd);
                          return (
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                {base != null ? fmtCardPrice(base) : rangeLabel ?? "—"}
                              </span>
                              {product.sale_price_usd != null && product.price_display_usd != null && (
                                <>
                                  <span className="text-xs text-gray-400 line-through">{fmtCardPrice(product.price_display_usd)}</span>
                                  <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                                    −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                                  </span>
                                </>
                              )}
                            </span>
                          );
                        }
                        if (product.status === "on_sale" && product.sale_price_usd != null) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-amber-600 dark:text-amber-400">{fmtCardPrice(product.sale_price_usd)}</span>
                              <span className="text-xs text-gray-400 line-through">
                                {rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : null)}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : "Contact for price")}
                          </span>
                        );
                      })()}
                      <span className="ProductCard_SizeOrigin text-xs text-gray-400 dark:text-gray-500 text-right">
                        {product.size ? `${product.size}mm` : ""}
                        {product.size && product.origin ? " · " : ""}
                        {product.origin && <span className={ORIGIN_TEXT[product.origin] ?? ""}>{product.origin}</span>}
                      </span>
                    </div>
                  </div>

                  {/* Info — mobile only */}
                  <div className={`ProductCard_InfoMobile sm:hidden p-2.5 flex flex-col gap-0.5 ${product.status === "sold" ? "opacity-80" : ""}`}>
                    <span className="ProductCard_Category text-[14px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{getCategoryLabel(product.category)}</span>
                    {product.tier?.length > 0 && (
                      <span className="ProductCard_Tier text-[13px] text-gray-400 dark:text-gray-500">{product.tier.join(" · ")}</span>
                    )}
                    <h2 className="ProductCard_Title text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">{product.name}</h2>
                    {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                      <div className="ProductCard_ColorTags flex flex-wrap gap-1 mt-1">
                        {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="ProductCard_PriceRow flex flex-col mt-1">
                      {(() => {
                        const vp = getVariantPrices(product);
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const hasRange = vMin != null && vMax != null && vMin !== vMax;
                        const rangeLabel = hasRange ? fmtRangeLabel(vMin!, vMax!) : null;
                        if (product.status === "sold") {
                          const base = product.sale_price_usd ?? (rangeLabel ? null : product.price_display_usd);
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {base != null ? fmtCardPrice(base) : rangeLabel ?? "—"}
                              </span>
                              {product.sale_price_usd != null && product.price_display_usd != null && (
                                <>
                                  <span className="text-[10px] text-gray-400 line-through">{fmtCardPrice(product.price_display_usd)}</span>
                                  <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1 py-0.5 text-[10px] font-semibold text-white">
                                    −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                                  </span>
                                </>
                              )}
                            </span>
                          );
                        }
                        if (product.status === "on_sale" && product.sale_price_usd != null) {
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{fmtCardPrice(product.sale_price_usd)}</span>
                              <span className="text-[10px] text-gray-400 line-through">
                                {rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : null)}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : "Contact for price")}
                          </span>
                        );
                      })()}
                      {(product.size || product.origin) && (
                        <span className="ProductCard_SizeOrigin text-[11px] mt-1 text-gray-400 dark:text-gray-500">
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
          <Suspense>
            <Pagination currentPage={safePage} totalPages={totalPages} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
