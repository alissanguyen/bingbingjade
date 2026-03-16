"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";

interface FeaturedProduct {
  id: string;
  name: string;
  category: string;
  images: string[];
  tier: string[];
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
}

function ArrowBtn({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="hidden sm:flex w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm shrink-0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left"
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

export function FeaturedCarousel({ products }: { products: FeaturedProduct[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const CARD_W = 308; // ~25% of max-w-7xl container + gap

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -CARD_W : CARD_W, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 py-14">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Handpicked
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Featured Pieces</h2>
          </div>
          <div className="flex items-center gap-3">
            <ArrowBtn dir="left" onClick={() => scroll("left")} />
            <ArrowBtn dir="right" onClick={() => scroll("right")} />
            <Link
              href="/products?status=available"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
            >
              View all
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Scroll track */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((product) => {
            const isSold   = product.status === "sold";
            const isOnSale = product.status === "on_sale";

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                style={{ scrollSnapAlign: "start" }}
                className={`group rounded-2xl border overflow-hidden transition-all hover:shadow-lg block shrink-0 w-[80vw] sm:w-[calc(50%-10px)] lg:w-[calc(25%-15px)] min-w-55 max-w-xs ${
                  isSold
                    ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
              >
                {/* Image */}
                <div className="relative w-full aspect-square bg-emerald-50 dark:bg-emerald-950 overflow-hidden">
                  {isSold && (
                    <div className="absolute top-2.5 left-2.5 z-10 bg-black text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
                      Sold
                    </div>
                  )}
                  {isOnSale && (
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                      <div className="bg-amber-400 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
                        On Sale
                      </div>
                      {product.price_display_usd != null && product.sale_price_usd != null && (
                        <div className="bg-red-500/80 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
                          −{Math.round((1 - product.sale_price_usd / product.price_display_usd) * 100)}%
                        </div>
                      )}
                    </div>
                  )}
                  {product.images?.[0] ? (
                    <div className={`grid h-full ${product.images.length >= 2 ? "w-[200%] grid-cols-2 group-hover:animate-peek" : "w-full grid-cols-1"}`}>
                      <div className="relative h-full">
                        <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="320px" loading="lazy" />
                      </div>
                      {product.images[1] && (
                        <div className="relative h-full">
                          <Image src={product.images[1]} alt="" fill className="object-cover" sizes="320px" loading="lazy" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🪨</div>
                  )}
                </div>

                {/* Info */}
                <div className={`p-4 ${isSold ? "opacity-80" : ""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {product.category}
                    </span>
                    {product.tier?.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">· {product.tier.join(" · ")}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug text-sm line-clamp-2">{product.name}</h3>
                  <div className="mt-2">
                    {isSold ? (
                      <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                        {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Sold"}
                      </span>
                    ) : isOnSale && product.sale_price_usd != null ? (
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">${product.sale_price_usd.toFixed(2)}</span>
                        {product.price_display_usd != null && (
                          <span className="text-xs text-gray-400 line-through">${product.price_display_usd.toFixed(2)}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Contact for price"}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mobile view all */}
        <div className="mt-6 text-center sm:hidden">
          <Link href="/products" className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
            View all products →
          </Link>
        </div>
      </div>
    </div>
  );
}
