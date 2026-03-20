"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGallery } from "./ProductGallery";

interface ProductOptionClient {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  images: string[]; // already resolved
  status: "available" | "sold";
  sort_order: number;
}

interface ProductClient {
  id: string;
  name: string;
  category: string;
  color: string[] | null;
  tier: string[];
  size: number;
  size_detailed: (number | null)[] | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  description: string | null;
  blemishes: string | null;
  is_featured: boolean | null;
  origin: string;
  status: string;
  slug: string;
  public_id: string;
}

const COLOR_SWATCHES: Record<string, string> = {
  white: "bg-white border border-gray-300",
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  pink: "bg-pink-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  black: "bg-gray-900",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

interface Props {
  product: ProductClient;
  productImages: string[];
  productVideos: string[];
  options: ProductOptionClient[];
}

export function ProductPageClient({ product, productImages, productVideos, options }: Props) {
  // Show selector if there are multiple options or any option has a label
  const hasSelector = options.length > 1 || (options.length === 1 && options[0].label !== null);
  // Default to the first non-sold option
  const firstAvailableIdx = options.findIndex((o) => o.status !== "sold");
  const [selectedIdx, setSelectedIdx] = useState(firstAvailableIdx >= 0 ? firstAvailableIdx : 0);
  const selectedOption = hasSelector ? (options[selectedIdx] ?? null) : null;

  // Effective values based on selected option
  const effectiveImages =
    (selectedOption?.images?.length ?? 0) > 0 ? selectedOption!.images : productImages;
  const effectiveSize = selectedOption?.size ?? product.size;
  const effectiveDisplayPrice = selectedOption?.price_usd ?? product.price_display_usd;
  const isOptionSold = selectedOption?.status === "sold";
  const isProductSold = product.status === "sold";
  const isEffectivelySold = isProductSold || isOptionSold;

  // "Highest price of the lot" — the reference used for discount % calculations.
  // = max of product.price_display_usd and all variant price overrides.
  const allOptionPrices = options
    .map((o) => o.price_usd ?? product.price_display_usd)
    .filter((p): p is number => p != null);
  const highestInLot = allOptionPrices.length > 0
    ? Math.max(...allOptionPrices, product.price_display_usd ?? 0)
    : (product.price_display_usd ?? 0);

  // Compute the discount % for the currently selected option (for the image badge)
  const selectedEffectivePrice =
    product.status === "on_sale" && product.sale_price_usd != null
      ? product.sale_price_usd
      : effectiveDisplayPrice;
  const imageBadgePct =
    highestInLot > 0 && selectedEffectivePrice != null && selectedEffectivePrice < highestInLot
      ? Math.round((1 - selectedEffectivePrice / highestInLot) * 100)
      : null;

  // Show the sale image badge if the product is on_sale OR any available variant is discounted
  const hasDiscountedVariant = options.some(
    (o) => o.status !== "sold" &&
      (o.price_usd ?? product.price_display_usd) != null &&
      (o.price_usd ?? product.price_display_usd)! < highestInLot
  );
  const showImageSaleBadge = product.status === "on_sale" || hasDiscountedVariant;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      {/* Gallery */}
      <div className="relative">
        <ProductGallery images={effectiveImages} videos={productVideos} category={product.category} />
        {showImageSaleBadge && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
            <div className="bg-amber-400 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
              On Sale
            </div>
            {imageBadgePct != null && imageBadgePct > 0 && (
              <div className="bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
                −{imageBadgePct}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="IndividualProduct_Details flex flex-col">
        {/* Category + tier + featured */}
        <div className="IndividualProduct_CategoryRow flex items-center gap-2 flex-wrap mb-3">
          <span className="IndividualProduct_Category text-md font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {product.category}
          </span>
          {product.tier?.length > 0 && (
            <span className="IndividualProduct_Tier text-sm font-bold text-gray-400 dark:text-gray-500">
              · {product.tier.join(" · ")}
            </span>
          )}
          <span className="IndividualProduct_Origin text-sm text-gray-400 dark:text-gray-500">
            · {product.origin}
          </span>
          {product.is_featured && (
            <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400">
              Featured
            </span>
          )}
        </div>

        <h1 className="IndividualProduct_Title text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
          {product.name}
        </h1>

        {/* Option selector */}
        {hasSelector && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Select Option
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((opt, i) => {
                // Effective price for this option
                const optPrice = opt.price_usd ?? product.price_display_usd;
                // On_sale: discount = variant price → sale_price_usd
                // Variant discount: variant price → highest price in the lot
                const effectiveOptPrice =
                  product.status === "on_sale" && product.sale_price_usd != null
                    ? product.sale_price_usd
                    : optPrice;
                const discountPct =
                  effectiveOptPrice != null &&
                  highestInLot > 0 &&
                  effectiveOptPrice < highestInLot
                    ? Math.round((1 - effectiveOptPrice / highestInLot) * 100)
                    : null;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { if (opt.status !== "sold") setSelectedIdx(i); }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                      i === selectedIdx
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium"
                        : opt.status === "sold"
                        ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 line-through cursor-not-allowed opacity-60"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer"
                    }`}
                  >
                    {opt.label}
                    {discountPct != null && opt.status !== "sold" && (
                      <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                        −{discountPct}%
                      </span>
                    )}
                    {opt.status === "sold" && (
                      <span className="text-xs not-italic">(Sold)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="IndividualProduct_PriceRow mt-3 flex items-baseline gap-3">
          {product.status === "on_sale" && product.sale_price_usd != null ? (
            <>
              <span className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                ${Number(product.sale_price_usd).toFixed(2)}
              </span>
              {effectiveDisplayPrice != null && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    ${Number(effectiveDisplayPrice).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-red-500/80 px-2.5 py-0.5 text-sm font-semibold text-white shadow-sm">
                    −{Math.round((1 - product.sale_price_usd / effectiveDisplayPrice) * 100)}%
                  </span>
                </>
              )}
            </>
          ) : isProductSold ? (
            <>
              <span className="text-2xl font-semibold text-gray-400 dark:text-gray-600">
                {product.sale_price_usd != null
                  ? `$${Number(product.sale_price_usd).toFixed(2)}`
                  : effectiveDisplayPrice != null
                  ? `$${Number(effectiveDisplayPrice).toFixed(2)}`
                  : "—"}
              </span>
              {product.sale_price_usd != null && effectiveDisplayPrice != null && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    ${Number(effectiveDisplayPrice).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-2.5 py-0.5 text-sm font-semibold text-white shadow-sm">
                    −{Math.round((1 - product.sale_price_usd / effectiveDisplayPrice) * 100)}%
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {effectiveDisplayPrice != null
                ? `$${Number(effectiveDisplayPrice).toFixed(2)}`
                : "Contact for price"}
            </span>
          )}
        </div>

        <div className="mt-6 space-y-5">
          {/* Color tags */}
          {(product.color?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {product.color!.map((c: string) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {effectiveSize != null && (
            <div className="IndividualProduct_Size">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Size</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{effectiveSize} mm</p>
            </div>
          )}

          {/* Detailed dimensions */}
          {product.size_detailed?.some((v) => v != null) && (
            <div className="IndividualProduct_Dimensions">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Dimensions</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {product.size_detailed.map((v, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-1.5 text-gray-300 dark:text-gray-600">×</span>}
                    {v != null ? `${v}` : "—"}
                  </span>
                ))} mm
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">size × width × thickness</p>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="IndividualProduct_Description">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Blemishes */}
          {product.blemishes && (
            <div className="IndividualProduct_Blemishes">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Blemishes</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.blemishes}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="IndividualProduct_CTA mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
          {/* Status badge */}
          <div className="mb-4">
            {isEffectivelySold ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-1 text-sm font-semibold text-red-600 dark:text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Sold
              </span>
            ) : product.status === "on_sale" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                On Sale
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Available
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Interested in this piece? Reach out directly to inquire or purchase.
          </p>
          <Link
            href={!isEffectivelySold ? `/contact?product=${product.public_id}` : "#"}
            className={`block w-full rounded-full py-3 text-center text-sm font-medium text-white transition-colors ${
              isEffectivelySold
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed pointer-events-none"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {isEffectivelySold ? "This item has been sold" : "Contact to Purchase"}
          </Link>
          <div className="text-sm">
            <p className="italic text-cyan-600 font-semibold mt-4">** We provide more pictures and videos of different lighting upon request.</p>
            <p className="text-gray-400 dark:text-gray-500 mt-2"><span className="mr-2 text-cyan-600">Not your styles?</span>Some pieces can be <span className="font-semibold text-gray-500">reshaped</span> or <span className="font-semibold text-gray-500">widened</span>, contact us for more details.</p>
          </div>

          {/* Authenticity Guarantee */}
          <div className="IndividualProduct_AuthenticityGuarantee mt-6 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Authenticity Guarantee</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              All jade offered is natural Jadeite (Type A), untreated and unenhanced, and we stand behind the authenticity of our jade for life.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed mt-2">
              Pieces priced above $200 include certification. For items under $200, certification is available upon request for $20.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
