"use client";

import { useRef } from "react";
import { ProductCardImage } from "./ProductCardImage";
import { ProductCardLink } from "./ProductCardLink";
import { getCategoryLabel } from "./categories";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import { productSlug } from "@/lib/slug";

function fmtCardPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
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

const ORIGIN_TEXT: Record<string, string> = {
  Myanmar: "text-emerald-600 dark:text-emerald-400",
  Guatemala: "text-blue-600 dark:text-blue-400",
  Hetian: "text-fuchsia-600 dark:text-fuchsia-400",
};

interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  public_id: string;
  category: string;
  origin: string;
  color: string[] | null;
  tier: string[] | null;
  size: number | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  quick_ship: boolean;
  cardImages: string[];
  colorOverlap: number;
}

function ArrowBtn({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="hidden sm:flex w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm shrink-0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

export function RelatedProductsCarousel({ products }: { products: RelatedProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 280;
    el.scrollBy({ left: dir === "left" ? -cardW : cardW, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
          You Might Also Like
        </h2>
        <div className="flex items-center gap-2">
          <ArrowBtn dir="left" onClick={() => scroll("left")} />
          <ArrowBtn dir="right" onClick={() => scroll("right")} />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {products.map((p) => {
          const cardSlug = productSlug(p);
          const isSold = p.status === "sold";
          const isOnSale = p.status === "on_sale";
          const colors = (p.color ?? []).filter((c) => c && c.trim());
          const tiers = p.tier ?? [];
          const displayPrice = p.sale_price_usd ?? p.price_display_usd;

          return (
            <ProductCardLink
              key={p.id}
              href={`/products/${cardSlug}`}
              style={{ scrollSnapAlign: "start" }}
              className={`group rounded-2xl border overflow-hidden hover:shadow-lg transition-all block shrink-0 w-[46vw] sm:w-[calc(33.33%-11px)] ${
                isSold
                  ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
              }`}
            >
              <ProductCardImage images={p.cardImages} name={p.name}>
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
                    {p.price_display_usd != null && p.sale_price_usd != null && (
                      <div className="bg-orange-500 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                        −{Math.round((1 - p.sale_price_usd / p.price_display_usd) * 100)}%
                      </div>
                    )}
                  </div>
                )}
                {p.quick_ship && !isSold && (
                  <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 z-10">
                    <div
                      className="flex items-center gap-1 sm:gap-1.5 bg-sky-950 border border-sky-400/60 text-sky-300 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                      style={{ boxShadow: "0 0 8px 1px rgba(56,189,248,0.35)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                      Available Now
                    </div>
                  </div>
                )}
              </ProductCardImage>

              {/* Info — desktop */}
              <div className={`hidden sm:block p-4 ${isSold ? "opacity-80" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {getCategoryLabel(p.category)}
                  </span>
                  {tiers.length > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">· {tiers.join(" · ")}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{p.name}</h3>
                {colors.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {colors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className={`font-medium ${isSold ? "text-gray-500 dark:text-gray-400" : isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {displayPrice != null ? fmtCardPrice(displayPrice) : "Contact for price"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                    {p.size ? `${p.size}mm` : ""}
                    {p.size && p.origin ? " · " : ""}
                    {p.origin && <span className={ORIGIN_TEXT[p.origin] ?? ""}>{p.origin}</span>}
                  </span>
                </div>
              </div>

              {/* Info — mobile */}
              <div className={`sm:hidden p-2.5 flex flex-col gap-0.5 ${isSold ? "opacity-80" : ""}`}>
                <span className="text-[14px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {getCategoryLabel(p.category)}
                </span>
                {tiers.length > 0 && (
                  <span className="text-[13px] text-gray-400 dark:text-gray-500">{tiers.join(" · ")}</span>
                )}
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">{p.name}</h3>
                {colors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {colors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1">
                  <span className={`text-xs font-medium ${isSold ? "text-gray-500 dark:text-gray-400" : isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {displayPrice != null ? fmtCardPrice(displayPrice) : "Contact for price"}
                  </span>
                </div>
              </div>
            </ProductCardLink>
          );
        })}
      </div>
    </section>
  );
}
