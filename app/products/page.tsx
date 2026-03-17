import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { FilterSidebar } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";

interface ProductCard {
  id: string;
  name: string;
  category: string;
  images: string[];
  color: string[] | null;
  tier: string[];
  size: number;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  description: string | null;
  is_featured: boolean;
  status: string;
}

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

export const revalidate = 21600;

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<{ colors?: string; status?: string; category?: string; minSize?: string; maxSize?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const selectedColors   = params.colors?.split(",").filter(Boolean) ?? [];
  const selectedStatuses = params.status?.split(",").filter(Boolean) ?? [];
  const selectedCategory = params.category ?? "";
  const minSize = params.minSize ? Number(params.minSize) : null;
  const maxSize = params.maxSize ? Number(params.maxSize) : null;
  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  const sort = params.sort ?? "";
  const PAGE_SIZE = 18;
  const currentPage = Math.max(1, Number(params.page ?? "1"));

  const { data: allProducts, error } = await supabase
    .from("products")
    .select("id, name, category, images, color, tier, size, price_display_usd, sale_price_usd, description, is_featured, status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load products:", error.message);
  }

  const products = (allProducts as ProductCard[] | null)?.filter((p) => {
    // Category filter
    if (selectedCategory && p.category !== selectedCategory) return false;
    // Status filter
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;
    // Color filter — product must have at least one of the selected colors
    if (selectedColors.length > 0) {
      const productColors = p.color ?? [];
      if (!selectedColors.some((c) => productColors.includes(c))) return false;
    }
    // Size filter
    if (minSize !== null && (p.size == null || p.size < minSize)) return false;
    if (maxSize !== null && (p.size == null || p.size > maxSize)) return false;
    // Price filter — use effective price
    const effectivePrice =
      p.status === "on_sale" && p.sale_price_usd != null
        ? p.sale_price_usd
        : p.price_display_usd;
    if (minPrice !== null && (effectivePrice == null || effectivePrice < minPrice)) return false;
    if (maxPrice !== null && (effectivePrice == null || effectivePrice > maxPrice)) return false;
    return true;
  }) ?? [];

  // Sort
  if (sort) {
    products.sort((a, b) => {
      if (sort === "price_asc" || sort === "price_desc") {
        const pa = (a.status === "on_sale" && a.sale_price_usd != null ? a.sale_price_usd : a.price_display_usd) ?? Infinity;
        const pb = (b.status === "on_sale" && b.sale_price_usd != null ? b.sale_price_usd : b.price_display_usd) ?? Infinity;
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

  const totalCount = products.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginated = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Browse our collection of authentic jade pieces.</p>

      <div className="mt-10 flex gap-6">
        {/* Filter sidebar — desktop only */}
        <Suspense>
          <FilterSidebar />
        </Suspense>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] sm:text-sm text-gray-400 dark:text-gray-500">
              {totalCount} {totalCount === 1 ? "item" : "items"}
              {totalPages > 1 && <span className="ml-1">· page {safePage} of {totalPages}</span>}
            </p>
            <Suspense>
              <SortSelect />
            </Suspense>
          </div>
          {products.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-600">
              No products match your filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {paginated.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className={`group rounded-2xl border overflow-hidden hover:shadow-lg transition-all block ${
                    product.status === "sold"
                      ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
                  }`}
                >
                  {/* Image strip — slides to peek at second image on hover */}
                  <div className="relative w-full aspect-square bg-emerald-50 dark:bg-emerald-950 overflow-hidden">
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

                    {product.images?.[0] ? (
                      <div className={`grid h-full ${product.images.length >= 2 ? "w-[200%] grid-cols-2 group-hover:animate-peek" : "w-full grid-cols-1"}`}>
                        <div className="relative h-full">
                          <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" loading="lazy" />
                        </div>
                        {product.images[1] && (
                          <div className="relative h-full">
                            <Image src={product.images[1]} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" loading="lazy" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🪨</div>
                    )}
                  </div>

                  {/* Info — desktop */}
                  <div className={`ProductCard_InfoDesktop hidden sm:block p-4 ${product.status === "sold" ? "opacity-80" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="ProductCard_Category text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {product.category}
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
                      {product.status === "sold" ? (
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-500 dark:text-gray-400">
                            {product.sale_price_usd != null ? `$${product.sale_price_usd.toFixed(2)}` : product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "—"}
                          </span>
                          {product.sale_price_usd != null && product.price_display_usd != null && (
                            <>
                              <span className="text-xs text-gray-400 line-through">${product.price_display_usd.toFixed(2)}</span>
                              <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                                −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                              </span>
                            </>
                          )}
                        </span>
                      ) : product.status === "on_sale" && product.sale_price_usd != null ? (
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-amber-600 dark:text-amber-400">${product.sale_price_usd.toFixed(2)}</span>
                          {product.price_display_usd != null && (
                            <span className="text-xs text-gray-400 line-through">${product.price_display_usd.toFixed(2)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Contact for price"}
                        </span>
                      )}
                      {product.size && (
                        <span className="ProductCard_Size text-xs text-gray-400 dark:text-gray-500">Size {product.size}mm</span>
                      )}
                    </div>
                  </div>

                  {/* Info — mobile only */}
                  <div className={`ProductCard_InfoMobile sm:hidden p-2.5 flex flex-col gap-0.5 ${product.status === "sold" ? "opacity-80" : ""}`}>
                    <span className="ProductCard_Category text-[14px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{product.category}</span>
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
                      {product.status === "sold" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {product.sale_price_usd != null ? `$${product.sale_price_usd.toFixed(2)}` : product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "—"}
                          </span>
                          {product.sale_price_usd != null && product.price_display_usd != null && (
                            <>
                              <span className="text-[10px] text-gray-400 line-through">${product.price_display_usd.toFixed(2)}</span>
                              <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1 py-0.5 text-[10px] font-semibold text-white">
                                −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                              </span>
                            </>
                          )}
                        </span>
                      ) : product.status === "on_sale" && product.sale_price_usd != null ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">${product.sale_price_usd.toFixed(2)}</span>
                          {product.price_display_usd != null && (
                            <span className="text-[10px] text-gray-400 line-through">${product.price_display_usd.toFixed(2)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Contact for price"}
                        </span>
                      )}
                      {product.size && (
                        <span className="ProductCard_Size text-[11px] mt-2 md:mt-0 text-gray-400 dark:text-gray-500">Size {product.size}mm</span>
                      )}
                    </div>
                  </div>
                </Link>
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
