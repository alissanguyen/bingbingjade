"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGallery } from "./ProductGallery";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useCart } from "@/app/components/CartContext";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import type { CartItem } from "@/types/cart";
import { getCategoryLabel } from "../categories";
import { BangleSizeGuide } from "@/app/components/BangleSizeGuide";
import { RingSizeGuide } from "@/app/components/RingSizeGuide";
import { PaymentMessaging } from "@/app/components/PaymentMessaging";

interface ProductOptionClient {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  sale_price_usd: number | null;
  image_index: number | null;
  status: "available" | "sold" | "on_sale";
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
  quick_ship: boolean;
  origin: string;
  status: string;
  slug: string;
  public_id: string;
}

const ORIGIN_BADGE: Record<string, string> = {
  Myanmar: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  Guatemala: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  Hetian: "border-fuchsia-200 dark:border-fuchsia-800 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-400",
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
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

function Accordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200/80 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

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
  const activeImageIndex = selectedOption?.image_index ?? null;
  const effectiveSize = selectedOption?.size ?? product.size;
  const effectiveDisplayPrice = selectedOption?.price_usd ?? product.price_display_usd;

  const isOptionSold = selectedOption?.status === "sold";
  const isOptionOnSale = selectedOption?.status === "on_sale";
  const isProductSold = product.status === "sold";
  const isEffectivelySold = isProductSold || isOptionSold;

  // Per-option sale_price_usd takes priority over product-level sale_price_usd.
  // Show sale price regardless of status so sold-via-checkout products still display the sale price.
  const activeSalePrice =
    selectedOption?.sale_price_usd != null
      ? selectedOption.sale_price_usd
      : product.sale_price_usd != null
        ? product.sale_price_usd
        : null;

  const isOnSale = activeSalePrice != null;

  // Discount % for the image badge (based on selected option)
  const imageBadgePct =
    isOnSale && activeSalePrice != null && effectiveDisplayPrice != null && effectiveDisplayPrice > 0
      ? Math.round((1 - activeSalePrice / effectiveDisplayPrice) * 100)
      : null;

  // Show the sale image badge if product-level or any available variant has a sale price
  const showImageSaleBadge =
    product.status === "on_sale" ||
    options.some((o) => o.sale_price_usd != null && o.status !== "sold");

  // Effective checkout price for the currently selected option
  const checkoutPrice = activeSalePrice ?? effectiveDisplayPrice;

  // High-value items ($20k+) show an obfuscated price and skip direct checkout
  const needsInquiry = requiresInquiry(checkoutPrice);

  // Check if currently selected option/product is already in cart
  const activeOptionId = hasSelector ? (options[selectedIdx]?.id ?? null) : null;
  const isInCart = cartItems.some(
    (c) => c.productId === product.id && c.optionId === activeOptionId
  );

  function handleAddToCart() {
    if (checkoutPrice == null) return;
    const thumbnail = productImages[activeImageIndex ?? 0] ?? productImages[0] ?? null;
    const activeOption = hasSelector ? options[selectedIdx] : null;
    const cartItem: CartItem = {
      productId: product.id,
      productPublicId: product.public_id,
      productName: product.name,
      productSlug: product.slug,
      optionId: activeOption?.id ?? null,
      optionLabel: activeOption?.label ?? null,
      price: checkoutPrice,
      originalPrice:
        effectiveDisplayPrice != null && effectiveDisplayPrice !== checkoutPrice
          ? effectiveDisplayPrice
          : null,
      thumbnail,
      quickShip: product.quick_ship,
      fulfillmentType: product.quick_ship ? "available_now" : "sourced_for_you",
    };
    addToCart(cartItem);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      {/* Gallery */}
      <div className="relative">
        <ProductGallery images={productImages} videos={productVideos} category={getCategoryLabel(product.category)} activeIndex={activeImageIndex} />
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
          <span className="IndividualProduct_Category text-sm sm:text-md font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {getCategoryLabel(product.category)}
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
          <h1 className="IndividualProduct_Title text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
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
                const unavailable = opt.status === "sold";
                const optBasePrice = opt.price_usd ?? product.price_display_usd;
                const optSalePrice =
                  opt.sale_price_usd != null
                    ? opt.sale_price_usd
                    : product.sale_price_usd != null
                      ? product.sale_price_usd
                      : null;
                const discountPct =
                  optSalePrice != null && optBasePrice != null && optSalePrice < optBasePrice
                    ? Math.round((1 - optSalePrice / optBasePrice) * 100)
                    : null;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { if (!unavailable) setSelectedIdx(i); }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm border transition-all ${i === selectedIdx
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium"
                      : unavailable
                        ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 line-through cursor-not-allowed opacity-60"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer"
                      }`}
                  >
                    {opt.label}
                    {discountPct != null && !unavailable && (
                      <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                        −{discountPct}%
                      </span>
                    )}
                    {opt.status === "sold" && <span className="text-xs not-italic">(Sold)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bundle deals */}


        {/* Price */}
        <div className="IndividualProduct_PriceRow mt-3 flex items-baseline gap-3 flex-wrap">
          {isOnSale && activeSalePrice != null ? (
            <>
              <span className={`text-xl sm:text-2xl font-semibold ${isProductSold ? "text-gray-400 dark:text-gray-600" : "text-amber-600 dark:text-amber-400"}`}>
                {requiresInquiry(activeSalePrice)
                  ? obfuscatedPrice(activeSalePrice)
                  : `$${Number(activeSalePrice).toFixed(2)}`}
              </span>
              {effectiveDisplayPrice != null && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {requiresInquiry(effectiveDisplayPrice)
                      ? obfuscatedPrice(effectiveDisplayPrice)
                      : `$${Number(effectiveDisplayPrice).toFixed(2)}`}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-white shadow-sm ${isProductSold ? "bg-gray-400 dark:bg-gray-600" : "bg-red-500/80"}`}>
                    −{Math.round((1 - activeSalePrice / effectiveDisplayPrice) * 100)}%
                  </span>
                </>
              )}
            </>
          ) : isProductSold ? (
            <>
              <span className="text-2xl font-semibold text-gray-400 dark:text-gray-600">
                {effectiveDisplayPrice != null
                  ? requiresInquiry(effectiveDisplayPrice)
                    ? obfuscatedPrice(effectiveDisplayPrice)
                    : `$${Number(effectiveDisplayPrice).toFixed(2)}`
                  : "—"}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                {effectiveDisplayPrice != null
                  ? needsInquiry
                    ? obfuscatedPrice(effectiveDisplayPrice)
                    : `$${Number(effectiveDisplayPrice).toFixed(2)}`
                  : "Contact for price"}
              </span>
              {needsInquiry && effectiveDisplayPrice != null && (
                <span className="text-xs text-gray-400 dark:text-gray-500">— inquire for exact price</span>
              )}
            </>
          )}
        </div>

        {/* BNPL payment messaging */}
        {!isEffectivelySold && !needsInquiry && checkoutPrice != null && (
          <PaymentMessaging price={checkoutPrice} className="mt-2" />
        )}

        {/* Raw material note */}
        {product.category === "raw_material" && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Price includes the cost of crafting this raw jadeite into a finished piece.
          </p>
        )}

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
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{effectiveSize} mm</p>
                {product.category === "bangle" && (
                  <BangleSizeGuide productSize={effectiveSize} />
                )}
                {product.category === "ring" && (
                  <RingSizeGuide productSize={effectiveSize} />
                )}
              </div>
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

        </div>

        {/* CTA */}
        <div className="IndividualProduct_CTA mt-4 pt-6">
          {/* Status badge */}
          <div className="mb-4">
            {isEffectivelySold ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-1 text-sm font-semibold text-red-600 dark:text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Sold

              </span>
            ) : isOnSale ? (
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
          {isEffectivelySold ? (<p className="text-sm text-gray-500 dark:text-gray-400 mt-6 mb-2">
            Interested in this piece? We can find you another one. <a href="/contact" target="_blank" className="hover:underline hover:transition-all duration-200 ease-in text-emerald-600 dark:text-emerald-500">Reach out to us</a>.
          </p>) : (<p className="text-sm text-gray-500 dark:text-gray-400 mt-6 mb-2">
            Interested in this piece? Add to cart to purchase, or reach out directly.
          </p>)

          }


          {/* Add to Cart / Inquire to Purchase */}
          {!isEffectivelySold && checkoutPrice != null ? (
            needsInquiry ? (
              <Link
                href={`/contact?product=${product.public_id}`}
                className="block w-full rounded-full py-3 text-center text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 transition-colors"
              >
                Inquire to Purchase
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isInCart}
                className={`block w-full rounded-full py-3 text-center text-sm font-medium text-white transition-colors ${isInCart ? "bg-emerald-500 cursor-default" : addedToCart ? "bg-emerald-600" : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
              >
                {isInCart ? "✓ Added to Cart" : addedToCart ? "✓ Added!" : "Add to Cart"}
              </button>
            )
          ) : (
            <div className="block w-full rounded-full py-3 text-center text-sm font-medium text-white bg-gray-400 dark:bg-gray-600 cursor-not-allowed">
              {isEffectivelySold ? "This item has been sold" : "Contact for price"}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:gap-4">
            {/* Contact to Purchase */}
            {!isEffectivelySold && (
              <Link
                href={`/contact?product=${product.public_id}`}
                className="mt-3 block w-full rounded-full border border-gray-300 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                Inquire more Details
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
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
                Ask on WhatsApp
              </a>
            )}
          </div>
          <div className="spacer-div h-4"></div>
          {/* Description */}
          {product.description && (
            <Accordion label="Description">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </Accordion>
          )}
          <div className="spacer-div h-4"></div>
          {/* Blemishes */}
          {product.blemishes && (
            <Accordion label="Blemishes">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.blemishes}</p>
            </Accordion>
          )}

          <p className="italic text-xs sm:text-sm text-emerald-600 font-semibold mt-8">** We can provide more pictures and videos of different lighting upon request.</p>
          {product.category === 'bangle' || product.category === 'raw_material' ? (<div className="text-sm">

            <p className="text-gray-400 text-xs sm:text-sm dark:text-gray-500 mt-2"><span className="mr-2 text-emerald-600">Not your styles?</span>Some pieces can be <span className="font-semibold text-gray-500">reshaped</span> or <span className="font-semibold text-gray-500">widened</span>, contact us for more details.</p>
          </div>) : null}
          {product.category === 'raw_material' ? (<div className="text-xs italic text-gray-500 mt-4">
            <p>*** Please note that custom made orders are not refundable nor returnable per our <a href="/policy" target="_blank" className="text-emerald-500 hover:underlined">policy</a>. </p>
          </div>) : null}

          {/* Shipping info */}
          {!isEffectivelySold && (
            product.quick_ship ? (
              <div className="mt-5 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-200/50 dark:bg-sky-950 px-4 py-3.5 flex items-start gap-3"
                style={{ boxShadow: "0 0 12px 2px rgba(56,189,248,0.18), 0 0 2px 0px rgba(56,189,248,0.35)" }}>
                <span className="shrink-0 w-2 h-2 rounded-full bg-sky-600 dark:bg-sky-400 shadow-[0_0_6px_2px_rgba(56,189,248,0.7)] animate-pulse mt-1.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-800 dark:text-sky-300 tracking-wide">Ship Now</p>
                  <ul className="mt-1.5 space-y-0.5">
                    <li className="text-xs sm:text-[15px] text-sky-600 dark:text-sky-200/80">✔ In U.S. inventory — ships in 2–5 business days</li>
                    <li className="text-xs sm:text-[15px] text-sky-600 dark:text-sky-200/80">✔ Fast returns &amp; exchanges</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-200/60 dark:bg-indigo-950/70 px-4 py-3.5 flex items-start gap-3"
                style={{ boxShadow: "0 0 12px 2px rgba(139, 56, 248, 0.18), 0 0 2px 0px rgba(123, 56, 248, 0.35)" }}>
                <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_6px_2px_rgba(123, 56, 248,0.7)] animate-pulse mt-1.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 tracking-wide">Sourced for You</p>
                  <ul className="mt-1.5 space-y-0.5">
                    <li className="text-xs sm:text-[15px] text-indigo-600 dark:text-indigo-200/80">✔ Inspected and certified upon order</li>
                    <li className="text-xs sm:text-[15px] text-indigo-600 dark:text-indigo-200/80">✔ Typically arrives in 2–4 weeks</li>
                  </ul>
                </div>
              </div>
            )
          )}
          {/* Authenticity Guarantee */}
          <div className="IndividualProduct_AuthenticityGuarantee mt-6 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Authenticity Guarantee</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Every piece is natural Jadeite (Type A), untreated and unenhanced. Each is backed by our lifetime authenticity guarantee and accompanied by certification for complete confidence.
            </p>
          </div>
          <div className="spacer-div h-4"></div>
          {product.origin !== "Hetian" ? (<>
            <Accordion label="Jade Meaning & Cultural Significance">
              <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                <p>
                  Beyond its beauty, jade carries deep cultural meaning shaped over
                  thousands of years. In many traditions, it is associated with protection,
                  balance, prosperity, and quiet strength — often chosen not just for how
                  it looks, but for what it represents.
                </p>

                <p className="mt-4">
                  Certain shapes and forms are believed to carry specific intentions.
                  The <span className="italic">Ping An Kou (平安扣)</span>, for example,
                  symbolizes peace, protection, and safe passage — its continuous circle
                  representing harmony and wholeness. Bangles are often worn as a form of
                  protection, believed to stay with the wearer through different stages of life.
                </p>

                <p className="mt-4">
                  Color also plays a meaningful role. Green jade is commonly associated
                  with prosperity and growth, lavender tones with calm and emotional balance,
                  and icy or clear jade with purity and clarity of mind. Each piece carries
                  a slightly different feeling — something many choose intuitively.
                </p>

                <p className="mt-4">
                  Because no two pieces are ever identical, selecting jade often becomes
                  a personal process — choosing what resonates, rather than simply what
                  looks perfect.
                </p>

                <p className="mt-4 italic">
                  Many of our clients choose jade not only for themselves, but as a
                  meaningful gift — something to protect, to celebrate, or to carry forward.
                </p>
                <p className="mt-4 text-slate-500">
                  If you&apos;re looking for a piece with a specific meaning or intention, we’re
                  happy to help you find the right one.
                </p>
              </div>
            </Accordion>
            <Accordion label="Authenticity & Natural Jadeite Guarantee">
              <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                <p>
                  At BingBing Jade, authenticity is not a marketing phrase — it is the
                  foundation of everything we do. We offer natural jadeite only, and every
                  piece is represented as untreated Type A jadeite with certification.
                </p>

                <p className="mt-4 font-bold">
                  In practical terms, this means no dye, no bleaching, no polymer
                  impregnation, and no chemical enhancement. We value honesty, careful
                  selection, and thoughtful presentation at every stage.
                </p>

                <p className="mt-4">
                  Each piece is backed by our lifetime authenticity guarantee. If a piece is
                  ever professionally tested and believed not to be Type A jadeite, you can return the piece to us for a full refund in accordance
                  with our guarantee terms.
                </p>

                <p className="mt-4">
                  Natural jadeite is never perfectly uniform, and that is part of its beauty.
                  Slight differences in color, glow, translucency, grain, and internal structure are
                  natural characteristics of genuine jadeite and may appear differently across
                  lighting conditions and environments. We provide many pictures and videos of different lighting conditions to best present the texture and conditions of our jades.
                </p>

                <p className="mt-4">
                  Every piece comes with certification from trusted laboratories, with additional GIA or NGTC certification
                  available for eligible items at additional cost. For items over $5000, GIA/NGTC Certification is provided as a complimentary.
                </p>
              </div>
            </Accordion>
          </>) : (<>
            <Accordion label="Hetian Meaning & Cultural Significance">
              <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                <p>
                  Hetian jade is a traditional nephrite jade long valued in Chinese culture
                  for its smooth texture, soft luster, and quiet elegance. Distinct from
                  jadeite, it is appreciated less for vivid translucency and more for its
                  warmth, refinement, and timeless character.
                </p>

                <p className="mt-4">
                  It is often associated with harmony, protection, balance, and virtue,
                  and is commonly chosen as a meaningful piece to wear, gift, or keep.
                  Many are drawn to Hetian jade for its understated beauty and calm presence.
                </p>

                <p className="mt-4">
                  Certain forms carry symbolic meaning as well. Circular pieces such as{" "}
                  <span className="italic">Ping An Kou (平安扣)</span> are traditionally
                  associated with peace, safety, and wholeness, while pendants and bangles
                  are often valued for their closeness to the body and enduring symbolism.
                </p>

                <p className="mt-4 italic">
                  More subtle than jadeite, Hetian jade is often chosen for its texture,
                  meaning, and sense of tradition.
                </p>
              </div>
            </Accordion>
            <Accordion label="Authenticity & Natural Hetian Jade (Nephrite) Guarantee">
              <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                <p>
                  In addition to jadeite, we occasionally offer natural Hetian jade — a
                  traditional nephrite jade selected for its quality, authenticity, and
                  character. While jadeite remains our primary specialty, we are pleased
                  to offer select Hetian pieces for clients who appreciate its distinct
                  material and cultural appeal.
                </p>

                <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">
                  Our Hetian pieces are represented as natural and untreated unless clearly
                  stated otherwise.
                </p>

                <p className="mt-4">
                  As with all natural jade materials, variations in tone, texture, luster,
                  and internal structure are part of the material itself and should not be
                  mistaken for treatment or imitation.
                </p>

                <p className="mt-4">
                  We also offer certification for Hetian jade through trusted laboratories,
                  with additional certification options available upon request depending on
                  the piece.
                </p>

                <p className="mt-4">
                  If a Hetian piece is ever professionally tested and believed not to be
                  natural nephrite jade, you may contact us to arrange review and
                  verification. If the returned findings confirm otherwise, a refund will
                  be issued in accordance with our guarantee terms.
                </p>
              </div>
            </Accordion>
          </>)}

          <div className="spacer-div h-3"></div>
          <Accordion label="Selection & Purchase">
            <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              <p>
                Each piece we offer is natural jadeite and entirely unique. Variations in color, translucency, and internal structure are inherent to untreated jade and contribute to its individuality. While we present every piece through detailed photos and videos across different lighting conditions, slight differences in appearance may occur depending on environment, lighting, and skin tone.
              </p>
              <p>
                We encourage clients to review all provided media carefully prior to purchase. Our team is always available to provide additional photos, videos, or guidance to ensure you feel confident in your selection.
              </p>
              <p>
                Due to the nature of these pieces, purchases are considered final unless otherwise stated. In certain cases, requests for return or exchange may be reviewed if submitted within 24–48 hours of confirmed delivery, in accordance with our shop terms. Items must remain in original condition, unworn and unaltered.
              </p>

              <p>
                If a piece becomes unavailable, or if you are searching for something more specific, we offer access to a wider private inventory through our custom sourcing service. Each request is handled with care, sourcing pieces that are closely aligned with your preferences.
              </p>
              <p className="text-slate-500 text-xs sm:text-sm dark:text-slate-500 italic leading-relaxed">
                For assistance or sourcing inquiries, please contact us — we are always happy to help you find a piece that feels right.
              </p>
            </div>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
