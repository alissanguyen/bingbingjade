"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGallery } from "./ProductGallery";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useCart } from "@/app/components/CartContext";
import type { CartItem } from "@/types/cart";

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

const ORIGIN_BADGE: Record<string, string> = {
  Myanmar:   "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  Guatemala: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  Hetian:    "border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-400",
};

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
  const { addToCart, items: cartItems } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);

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

  // Effective checkout price for the currently selected option
  const checkoutPrice =
    product.status === "on_sale" && product.sale_price_usd != null
      ? product.sale_price_usd
      : effectiveDisplayPrice;

  // Check if currently selected option/product is already in cart
  const activeOptionId = hasSelector ? (options[selectedIdx]?.id ?? null) : null;
  const isInCart = cartItems.some(
    (c) => c.productId === product.id && c.optionId === activeOptionId
  );

  function handleAddToCart() {
    if (checkoutPrice == null) return;
    const thumbnail = effectiveImages[0] ?? null;
    const activeOption = hasSelector ? options[selectedIdx] : null;
    const cartItem: CartItem = {
      productId: product.id,
      productPublicId: product.public_id,
      productName: product.name,
      productSlug: product.slug,
      optionId: activeOption?.id ?? null,
      optionLabel: activeOption?.label ?? null,
      price: checkoutPrice,
      thumbnail,
    };
    addToCart(cartItem);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }

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
          {product.is_featured && (
            <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400">
              Featured
            </span>
          )}
        </div>

        <div className="flex items-start gap-2.5 flex-wrap">
          <h1 className="IndividualProduct_Title text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {product.name}
          </h1>
          <span className={`IndividualProduct_Origin mt-1 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORIGIN_BADGE[product.origin] ?? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {product.origin}
          </span>
        </div>

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
            Interested in this piece? Add to cart to purchase, or reach out directly.
          </p>

          {/* Add to Cart */}
          {!isEffectivelySold && checkoutPrice != null ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isInCart}
              className={`block w-full rounded-full py-3 text-center text-sm font-medium text-white transition-colors ${
                isInCart
                  ? "bg-emerald-500 cursor-default"
                  : addedToCart
                  ? "bg-emerald-600"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {isInCart ? "✓ Added to Cart" : addedToCart ? "✓ Added!" : "Add to Cart"}
            </button>
          ) : (
            <div
              className="block w-full rounded-full py-3 text-center text-sm font-medium text-white bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
            >
              {isEffectivelySold ? "This item has been sold" : "Contact for price"}
            </div>
          )}

          {/* Contact to Purchase */}
          {!isEffectivelySold && (
            <Link
              href={`/contact?product=${product.public_id}`}
              className="mt-3 block w-full rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              Contact to Purchase
            </Link>
          )}

          {!isEffectivelySold && (
            <a
              href={buildWhatsAppLink([{ name: product.name, public_id: product.public_id, slug: product.slug }])}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 w-full rounded-full border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 py-3 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/60 hover:border-green-400 dark:hover:border-green-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
              Ask on WhatsApp
            </a>
          )}
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
