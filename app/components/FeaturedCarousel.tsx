"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { productSlug } from "@/lib/slug";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import { getCategoryLabel } from "../products/categories";

function fmtPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
}

function fmtRangeLabel(min: number, max: number): string {
  return `${fmtPrice(min)} – ${fmtPrice(max)}`;
}

interface FeaturedProduct {
  id: string;
  name: string;
  category: string;
  images: string[];
  tier: string[];
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  slug: string;
  public_id: string;
  origin?: string | null;
  color?: string[] | null;
  size?: number | null;
}

const ORIGIN_TEXT: Record<string, string> = {
  Myanmar: "text-emerald-600 dark:text-emerald-400",
  Guatemala: "text-blue-600 dark:text-blue-400",
  Hetian: "text-fuchsia-600 dark:text-fuchsia-400",
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

function ArrowBtn({
  dir,
  onClick,
}: {
  dir: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="hidden sm:flex w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm shrink-0"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dir === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}

export function FeaturedCarousel({ products }: { products: FeaturedProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const CARD_W = 308;

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -CARD_W : CARD_W,
      behavior: "smooth",
    });
  }

  if (products.length === 0) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Handpicked
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Featured Pieces
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <ArrowBtn dir="left" onClick={() => scroll("left")} />
            <ArrowBtn dir="right" onClick={() => scroll("right")} />
            <Link
              href="/products?status=available"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
            >
              View all
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-2"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {products.map((product) => {
            const isSold = product.status === "sold";
            const isOnSale = product.status === "on_sale";
            const colors = (product.color ?? []).filter((c) => c && c.trim());
            const basePrice = product.price_display_usd;
            const salePrice = product.sale_price_usd;
            const hasRange = false;
            const rangeLabel =
              hasRange && basePrice != null && salePrice != null
                ? fmtRangeLabel(Math.min(basePrice, salePrice), Math.max(basePrice, salePrice))
                : null;

            return (
              <Link
                key={product.id}
                href={`/products/${productSlug(product)}`}
                style={{ scrollSnapAlign: "start" }}
                className={`group rounded-2xl border overflow-hidden hover:shadow-lg transition-all block shrink-0 w-[80vw] sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)] min-w-55 max-w-xs ${isSold
                  ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
                  }`}
              >
                <div className="relative w-full aspect-square bg-emerald-50 dark:bg-emerald-950 overflow-hidden">
                  {isSold && (
                    <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 bg-black text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                      Sold
                    </div>
                  )}

                  {isOnSale && (
                    <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5">
                      <div className="bg-amber-400 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                        On Sale
                      </div>
                      {basePrice != null && salePrice != null && (
                        <div className="bg-red-500/80 text-white text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                          −{Math.round((1 - salePrice / basePrice) * 100)}%
                        </div>
                      )}
                    </div>
                  )}

                  {product.images?.[0] ? (
                    <div
                      className={`grid h-full ${product.images.length >= 2
                        ? "w-[200%] grid-cols-2 group-hover:animate-peek"
                        : "w-full grid-cols-1"
                        }`}
                    >
                      <div className="relative h-full">
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="320px"
                          loading="lazy"
                        />
                      </div>

                      {product.images[1] && (
                        <div className="relative h-full">
                          <Image
                            src={product.images[1]}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="320px"
                            loading="lazy"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">
                      🪨
                    </div>
                  )}
                </div>

                <div
                  className={`hidden sm:block p-4 ${isSold ? "opacity-80" : ""
                    }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {getCategoryLabel(product.category)}
                    </span>
                    {product.tier?.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        · {product.tier.join(" · ")}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                    {product.name}
                  </h3>

                  {colors.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {colors.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400"
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"
                              }`}
                          />
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    {isSold ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-gray-500 dark:text-gray-400">
                          {salePrice != null
                            ? fmtPrice(salePrice)
                            : rangeLabel ?? (basePrice != null ? fmtPrice(basePrice) : "—")}
                        </span>
                        {salePrice != null && basePrice != null && (
                          <>
                            <span className="text-xs text-gray-400 line-through">
                              {fmtPrice(basePrice)}
                            </span>
                            <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                              −{Math.round((1 - salePrice / basePrice) * 100)}%
                            </span>
                          </>
                        )}
                      </span>
                    ) : isOnSale && salePrice != null ? (
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {fmtPrice(salePrice)}
                        </span>
                        {basePrice != null && (
                          <span className="text-xs text-gray-400 line-through">
                            {fmtPrice(basePrice)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {rangeLabel ??
                          (basePrice != null ? fmtPrice(basePrice) : "Contact for price")}
                      </span>
                    )}

                    <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                      {product.size ? `${product.size}mm` : ""}
                      {product.size && product.origin ? " · " : ""}
                      {product.origin && (
                        <span className={ORIGIN_TEXT[product.origin] ?? ""}>
                          {product.origin}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div
                  className={`sm:hidden p-2.5 flex flex-col gap-0.5 ${isSold ? "opacity-80" : ""
                    }`}
                >
                  <span className="text-[14px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {getCategoryLabel(product.category)}
                  </span>

                  {product.tier?.length > 0 && (
                    <span className="text-[13px] text-gray-400 dark:text-gray-500">
                      {product.tier.join(" · ")}
                    </span>
                  )}

                  <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">
                    {product.name}
                  </h3>

                  {colors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {colors.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"
                              }`}
                          />
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-row items-center justify-between w-full mt-1">
                    {isSold ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {salePrice != null
                            ? fmtPrice(salePrice)
                            : rangeLabel ?? (basePrice != null ? fmtPrice(basePrice) : "—")}
                        </span>
                        {salePrice != null && basePrice != null && (
                          <>
                            <span className="text-[10px] text-gray-400 line-through">
                              {fmtPrice(basePrice)}
                            </span>
                            <span className="rounded-full bg-gray-400 dark:bg-gray-600 px-1 py-0.5 text-[10px] font-semibold text-white">
                              −{Math.round((1 - salePrice / basePrice) * 100)}%
                            </span>
                          </>
                        )}
                      </span>
                    ) : isOnSale && salePrice != null ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {fmtPrice(salePrice)}
                        </span>
                        {basePrice != null && (
                          <span className="text-[10px] text-gray-400 line-through">
                            {fmtPrice(basePrice)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {rangeLabel ??
                          (basePrice != null ? fmtPrice(basePrice) : "Contact for price")}
                      </span>
                    )}

                    {(product.size || product.origin) && (
                      <span className="text-[11px] mt-1 text-gray-400 dark:text-gray-500 flex flex-row items-center gap-1">
                        <span>{product.size ? `${product.size}mm` : ""}</span>
                        <span>{product.size && product.origin ? " · " : ""}</span>
                        {product.origin && (
                          <span className={ORIGIN_TEXT[product.origin] ?? ""}>
                            {product.origin}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/products"
            className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            View all products →
          </Link>
        </div>
      </div>
    </div>
  );
}