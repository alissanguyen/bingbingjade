import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { productSlug } from "@/lib/slug";
import { resolveImageUrls } from "@/lib/storage";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import { FilterSidebar } from "@/app/products/FilterSidebar";
import { SortSelect } from "@/app/products/SortSelect";
import { Pagination } from "@/app/products/Pagination";
import { ProductCardImage } from "@/app/products/ProductCardImage";
import { ProductCardLink } from "@/app/products/ProductCardLink";
import { getCategoryLabel } from "@/app/products/categories";

export const dynamic = "force-dynamic";

function fmtCardPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
}
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
  lavender: "bg-purple-300",
  orange:   "bg-orange-500",
  yellow:   "bg-yellow-400",
  black:    "bg-gray-900",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

export default async function ProductsAllPreview({
  searchParams,
}: {
  searchParams: Promise<{ colors?: string; status?: string; category?: string; origins?: string; minSize?: string; maxSize?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: string }>;
}) {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const params = await searchParams;
  const selectedColors   = params.colors?.split(",").filter(Boolean) ?? [];
  const selectedStatuses = params.status?.split(",").filter(Boolean) ?? [];
  const selectedOrigins  = params.origins?.split(",").filter(Boolean) ?? [];
  const selectedCategory = params.category ?? "";
  const minSize  = params.minSize  ? Number(params.minSize)  : null;
  const maxSize  = params.maxSize  ? Number(params.maxSize)  : null;
  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  const sort = params.sort ?? "";
  const PAGE_SIZE = 18;
  const currentPage = Math.max(1, Number(params.page ?? "1"));

  // Fetch ALL products including drafts using admin client (bypasses RLS)
  const [{ data: allProducts }, { data: allOptions }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, origin, images, color, tier, size, price_display_usd, sale_price_usd, is_published, status, slug, public_id, quick_ship")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("product_options")
      .select("product_id, price_usd, sale_price_usd, status")
      .returns<OptionPriceRow[]>(),
  ]);

  const optionMap = new Map<string, OptionPriceRow[]>();
  for (const opt of allOptions ?? []) {
    const arr = optionMap.get(opt.product_id) ?? [];
    arr.push(opt);
    optionMap.set(opt.product_id, arr);
  }

  function getVariantPrices(p: ProductCard): number[] {
    const opts = optionMap.get(p.id) ?? [];
    const available = opts.filter((o) => o.status !== "sold");
    const pool = available.length > 0 ? available : opts;
    return pool
      .map((o) => o.sale_price_usd ?? o.price_usd ?? p.price_display_usd)
      .filter((v): v is number => v != null);
  }

  function effectiveSortPrice(p: ProductCard): number {
    if (p.status === "on_sale" && p.sale_price_usd != null) return p.sale_price_usd;
    const vp = getVariantPrices(p);
    return vp.length > 0 ? Math.min(...vp) : (p.price_display_usd ?? Infinity);
  }

  const products = (allProducts as ProductCard[] | null)?.filter((p) => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (selectedStatuses.length > 0) {
      const effectiveStatus = selectedStatuses.includes("available") && p.status === "on_sale"
        ? "available" : p.status;
      if (!selectedStatuses.includes(effectiveStatus)) return false;
    }
    if (selectedOrigins.length > 0 && !selectedOrigins.includes(p.origin)) return false;
    if (selectedColors.length > 0) {
      const productColors = p.color ?? [];
      if (!selectedColors.some((c) => productColors.includes(c))) return false;
    }
    if (minSize !== null && (p.size == null || p.size < minSize)) return false;
    if (maxSize !== null && (p.size == null || p.size > maxSize)) return false;
    if (minPrice !== null || maxPrice !== null) {
      const effectivePrice = p.status === "on_sale" && p.sale_price_usd != null ? p.sale_price_usd : null;
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

  let sorted: ProductCard[];
  if (sort === "newest") {
    sorted = products;
  } else if (sort === "price_asc" || sort === "price_desc") {
    sorted = [...products].sort((a, b) => {
      const pa = effectiveSortPrice(a), pb = effectiveSortPrice(b);
      return sort === "price_asc" ? pa - pb : pb - pa;
    });
  } else if (sort === "size_asc" || sort === "size_desc") {
    sorted = [...products].sort((a, b) => {
      const sa = a.size ?? Infinity, sb = b.size ?? Infinity;
      return sort === "size_asc" ? sa - sb : sb - sa;
    });
  } else {
    const groups = new Map<string, ProductCard[]>();
    for (const p of products) {
      const key = p.category ?? "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const queues = [...groups.values()];
    sorted = [];
    while (queues.some((q) => q.length > 0)) {
      for (const q of queues) { if (q.length > 0) sorted.push(q.shift()!); }
    }
  }

  const allProductsList = (allProducts as ProductCard[] | null) ?? [];
  const countBase = selectedCategory
    ? allProductsList.filter((p) => p.category === selectedCategory)
    : allProductsList;
  const statusCounts: Record<string, number> = {};
  const originCounts: Record<string, number> = {};
  const colorCounts:  Record<string, number> = {};
  for (const p of countBase) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    if (p.origin) originCounts[p.origin] = (originCounts[p.origin] ?? 0) + 1;
    for (const c of p.color ?? []) {
      if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }

  const totalCount  = sorted.length;
  const totalPages  = Math.ceil(totalCount / PAGE_SIZE);
  const safePage    = Math.min(currentPage, Math.max(1, totalPages));
  const paginated   = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const firstTwoPaths = paginated.flatMap((p) => [p.images?.[0] ?? "", p.images?.[1] ?? ""]);
  const resolvedFirstTwo = await resolveImageUrls(firstTwoPaths);
  const paginatedWithImages = paginated.map((p, i) => {
    const raw0 = firstTwoPaths[i * 2];
    const raw1 = firstTwoPaths[i * 2 + 1];
    const r0 = raw0 ? resolvedFirstTwo[i * 2] : "";
    const r1 = raw1 ? resolvedFirstTwo[i * 2 + 1] : "";
    return { ...p, images: [r0, r1, ...(p.images?.slice(2) ?? [])].filter(Boolean) };
  });

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Admin Preview — includes drafts
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">All Products</h1>
        <p className="text-xs sm:text-base mt-2 text-gray-500 dark:text-gray-400">
          Showing all {allProductsList.length} products ({allProductsList.filter(p => !p.is_published).length} drafts).
        </p>
      </div>

      <div className="mt-6 flex gap-6">
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] sm:text-sm text-gray-400 dark:text-gray-500">
              {totalCount} {totalCount === 1 ? "item" : "items"}
              {totalPages > 1 && <span className="ml-1">· page {safePage} of {totalPages}</span>}
            </p>
            <SortSelect initialSort={sort} />
          </div>

          {sorted.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600">No products match your filters.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedWithImages.map((product, i) => (
                <ProductCardLink
                  key={product.id}
                  href={`/products/${productSlug(product)}`}
                  className={`group rounded-2xl overflow-hidden transition-all duration-500 block ${
                    product.status === "sold"
                      ? "bg-gray-100 dark:bg-gray-800/60 shadow-sm"
                      : "bg-white dark:bg-gray-900 shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.13)] dark:hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] hover:-translate-y-1"
                  }`}
                >
                  <ProductCardImage images={product.images ?? []} name={product.name} priority={i === 0}>
                    {product.status === "sold" && (
                      <div className="absolute inset-0 bg-black/45 z-10 pointer-events-none" />
                    )}
                    {!product.is_published && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-full">
                        Draft
                      </div>
                    )}
                    {product.status === "sold" && (
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-gray-500 dark:text-gray-400 text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full">
                        Sold
                      </div>
                    )}
                    {product.status === "on_sale" && (
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex items-center gap-1.5">
                        {product.price_display_usd != null && product.sale_price_usd != null && (
                          <div className="bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full">
                            −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                          </div>
                        )}
                      </div>
                    )}
                    {product.quick_ship && product.status !== "sold" && (
                      <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10">
                        <div
                          className="flex items-center gap-1 sm:gap-1.5 bg-sky-950/90 backdrop-blur-sm border border-sky-400/40 text-sky-300 text-[10px] font-medium tracking-wide px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                          style={{ boxShadow: "0 0 10px 1px rgba(56,189,248,0.25)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                          Available Now
                        </div>
                      </div>
                    )}
                  </ProductCardImage>

                  {/* Info — desktop */}
                  <div className={`hidden sm:block px-5 pt-4 pb-5 ${product.status === "sold" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[14px] font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                        {getCategoryLabel(product.category)}
                      </span>
                      {product.tier?.length > 0 && (
                        <>
                          <span className="text-[14px] text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-[14px] text-gray-400 dark:text-gray-500 italic">{product.tier.join(" · ")}</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                    {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1.5 text-[15px] text-gray-500 dark:text-gray-400">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`mt-3 pt-3 border-t dark:border-gray-800 flex items-center justify-between ${product.status === "sold" ? "border-gray-200" : "border-gray-100"}`}>
                      {(() => {
                        const vp = getVariantPrices(product);
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const rangeLabel = vMin != null && vMax != null && vMin !== vMax ? fmtRangeLabel(vMin, vMax) : null;
                        if (product.status === "sold") {
                          const base = product.sale_price_usd ?? (rangeLabel ? null : product.price_display_usd);
                          return <span className="text-[17px] text-gray-400 dark:text-gray-500">{base != null ? fmtCardPrice(base) : rangeLabel ?? "—"}</span>;
                        }
                        if (product.status === "on_sale" && product.sale_price_usd != null) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-[17px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(product.sale_price_usd)}</span>
                              <span className="text-[15px] text-gray-300 dark:text-gray-600 line-through">{rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : null)}</span>
                            </span>
                          );
                        }
                        return <span className="text-[17px] font-semibold text-gray-800 dark:text-gray-200">{rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : "Contact for price")}</span>;
                      })()}
                      <span className="text-[15px] text-gray-400 dark:text-gray-500 text-right">
                        {product.size ? `${product.size}mm` : ""}
                        {product.size && product.origin ? " · " : ""}
                        {product.origin && <span className={ORIGIN_TEXT[product.origin] ?? ""}>{product.origin}</span>}
                      </span>
                    </div>
                  </div>

                  {/* Info — mobile */}
                  <div className={`sm:hidden px-2 pt-3 pb-3.5 flex flex-col gap-1 ${product.status === "sold" ? "opacity-70" : ""}`}>
                    <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">{getCategoryLabel(product.category)}</span>
                    {product.tier?.length > 0 && (
                      <span className="text-[8px] text-gray-400 dark:text-gray-500 italic">{product.tier.join(" · ")}</span>
                    )}
                    <h2 className="text-[10px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                    <div className={`mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between`}>
                      {(() => {
                        const vp = getVariantPrices(product);
                        const vMin = vp.length > 0 ? Math.min(...vp) : null;
                        const vMax = vp.length > 0 ? Math.max(...vp) : null;
                        const rangeLabel = vMin != null && vMax != null && vMin !== vMax ? fmtRangeLabel(vMin, vMax) : null;
                        if (product.status === "sold") return <span className="text-[10px] text-gray-400 dark:text-gray-500">{product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : "—"}</span>;
                        if (product.status === "on_sale" && product.sale_price_usd != null) {
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{fmtCardPrice(product.sale_price_usd)}</span>
                              <span className="text-[8px] text-gray-300 dark:text-gray-600 line-through">{product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : null}</span>
                            </span>
                          );
                        }
                        return <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">{rangeLabel ?? (product.price_display_usd != null ? fmtCardPrice(product.price_display_usd) : "—")}</span>;
                      })()}
                      <span className="text-[7px] text-gray-400 dark:text-gray-500">{product.size ? `${product.size}mm` : ""}</span>
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
                ...(params.colors   ? { colors:    params.colors }    : {}),
                ...(params.status   ? { status:    params.status }    : {}),
                ...(params.category ? { category:  params.category }  : {}),
                ...(params.origins  ? { origins:   params.origins }   : {}),
                ...(params.minSize  ? { minSize:   params.minSize }   : {}),
                ...(params.maxSize  ? { maxSize:   params.maxSize }   : {}),
                ...(params.minPrice ? { minPrice:  params.minPrice }  : {}),
                ...(params.maxPrice ? { maxPrice:  params.maxPrice }  : {}),
                ...(params.sort     ? { sort:      params.sort }      : {}),
              })
            ).toString()}
          />
        </div>
      </div>
    </div>
  );
}
