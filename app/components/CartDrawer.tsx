"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartContext";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";
import { supabase } from "@/lib/supabase";

function fmtPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
}

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeFromCart, clearCart } = useCart();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [soldKeys, setSoldKeys] = useState<Set<string>>(new Set());
  const [staleKeys, setStaleKeys] = useState<Set<string>>(new Set());
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check live availability when drawer opens
  useEffect(() => {
    if (!drawerOpen || items.length === 0) return;

    async function checkAvailability() {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const optionIds = items.map((i) => i.optionId).filter((id): id is string => id !== null);

      const [{ data: products }, { data: options }] = await Promise.all([
        supabase.from("products").select("id, status").in("id", productIds),
        optionIds.length > 0
          ? supabase.from("product_options").select("id, status").in("id", optionIds)
          : Promise.resolve({ data: [] }),
      ]);

      const productStatus = new Map(products?.map((p: { id: string; status: string }) => [p.id, p.status]) ?? []);
      const optionStatus = new Map((options ?? []).map((o: { id: string; status: string }) => [o.id, o.status]));

      const sold = new Set<string>();
      const stale = new Set<string>();
      for (const item of items) {
        const key = `${item.productId}-${item.optionId}`;
        if (item.optionId !== null) {
          if (optionStatus.get(item.optionId) === "sold") {
            sold.add(key);
          } else if (!optionStatus.has(item.optionId)) {
            // Option no longer exists — product was re-edited (options recreated with new UUIDs)
            // If the product itself is sold, treat as sold; otherwise just stale
            if (productStatus.get(item.productId) === "sold") {
              sold.add(key);
            } else {
              stale.add(key);
            }
          }
        } else {
          if (productStatus.get(item.productId) === "sold") {
            sold.add(key);
          }
        }
      }
      setSoldKeys(sold);
      setStaleKeys(stale);
    }
    checkAvailability();
  }, [drawerOpen, items]);

  // Measure the sticky header so the drawer starts below it
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeDrawer]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const availableItems = items.filter((i) => !soldKeys.has(`${i.productId}-${i.optionId}`) && !staleKeys.has(`${i.productId}-${i.optionId}`));
  const total = availableItems.reduce((sum, i) => sum + i.price, 0);
  const originalTotal = availableItems.reduce((sum, i) => sum + (i.originalPrice ?? i.price), 0);
  const totalSavings = originalTotal - total;

  return (
    <>
      {/* Invisible click-outside trap */}
      <div
        ref={overlayRef}
        onClick={closeDrawer}
        className={`fixed inset-x-0 bottom-0 z-30 ${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ top: headerHeight }}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 bottom-0 z-30 w-full max-w-sm bg-white/90 dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col"
        style={{
          top: headerHeight,
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-1 sm:py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-[13px] sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cart ({items.length})
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
              <span className="text-5xl">🛍️</span>
              <p className="text-[13px] sm:text-[18px] text-gray-500 dark:text-gray-400">Your cart is empty.</p>
              <button
                onClick={closeDrawer}
                className="mt-2 text-[12px] sm:text-[17px] text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Continue browsing
              </button>
            </div>
          ) : (
            <>
              {/* Available items */}
              {items.filter((item) => !soldKeys.has(`${item.productId}-${item.optionId}`) && !staleKeys.has(`${item.productId}-${item.optionId}`)).map((item) => {
                const productPath = item.productSlug
                  ? `/products/${item.productSlug}-${item.productPublicId}`
                  : `/products/${item.productPublicId}`;
                return (
                  <div key={`${item.productId}-${item.optionId}`} className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="h-16 w-16 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                      {item.thumbnail ? (
                        <Image
                          src={item.thumbnail}
                          alt={item.productName}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                          loading="eager"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <Link
                        href={productPath}
                        onClick={closeDrawer}
                        className="text-[12px] sm:text-[17px] font-medium text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 leading-snug"
                      >
                        {item.productName}
                      </Link>
                      {item.optionLabel && (
                        <p className="text-[12px] sm:text-[16px] text-gray-500 dark:text-gray-400 mt-0.5">{item.optionLabel}</p>
                      )}
                      {/* Badges row */}
                      {(item.quickShip || item.originalPrice != null) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.quickShip && (
                            <div
                              className="inline-flex items-center gap-1 bg-sky-950 border border-sky-400/60 text-sky-300 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ boxShadow: "0 0 6px 1px rgba(56,189,248,0.3)" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                              Ships Now
                            </div>
                          )}
                          {item.originalPrice != null && (
                            <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                              On Sale · −{Math.round((1 - item.price / item.originalPrice) * 100)}%
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[12px] sm:text-[17px] font-semibold ${item.originalPrice != null ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {fmtPrice(item.price)}
                        </span>
                        {item.originalPrice != null && (
                          <span className="text-[12px] sm:text-[17px] text-gray-400 line-through">
                            {fmtPrice(item.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeFromCart(item.productId, item.optionId)}
                      aria-label="Remove item"
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 self-start mt-0.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Sold items */}
              {items.filter((item) => soldKeys.has(`${item.productId}-${item.optionId}`)).map((item) => (
                <div key={`sold-${item.productId}-${item.optionId}`} className="flex gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-2.5">
                  <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={item.productName}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover grayscale opacity-50"
                        unoptimized
                        loading="eager"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] sm:text-[17px] font-medium text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug">{item.productName}</p>
                    {item.optionLabel && (
                      <p className="text-[12px] sm:text-[17px] text-gray-400 dark:text-gray-500 mt-0.5">{item.optionLabel}</p>
                    )}
                    <p className="text-[12px] sm:text-[17px] text-red-600 dark:text-red-400 font-medium mt-1">This product is no longer available.</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId, item.optionId)}
                    aria-label="Remove item"
                    className="text-[12px] sm:text-[17px] text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors shrink-0 self-center font-medium px-1"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* Stale items — product still available but option was recreated */}
              {items.filter((item) => staleKeys.has(`${item.productId}-${item.optionId}`)).map((item) => {
                const productPath = item.productSlug
                  ? `/products/${item.productSlug}-${item.productPublicId}`
                  : `/products/${item.productPublicId}`;
                return (
                  <div key={`stale-${item.productId}-${item.optionId}`} className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-2.5">
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                      {item.thumbnail ? (
                        <Image
                          src={item.thumbnail}
                          alt={item.productName}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover opacity-60"
                          unoptimized
                          loading="eager"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] sm:text-[17px] font-medium text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug">{item.productName}</p>
                      {item.optionLabel && (
                        <p className="text-[12px] sm:text-[17px] text-gray-400 dark:text-gray-500 mt-0.5">{item.optionLabel}</p>
                      )}
                      <p className="text-[12px] sm:text-[17px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                        This item was updated —{" "}
                        <Link href={productPath} onClick={closeDrawer} className="underline">re-add it from the product page</Link>.
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId, item.optionId)}
                      aria-label="Remove item"
                      className="text-[12px] sm:text-[17px] text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors shrink-0 self-center font-medium px-1"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        {availableItems.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 space-y-3">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-[12px] sm:text-sm">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <div className="flex items-center gap-2">
                {totalSavings > 0 && (
                  <span className="text-xs text-gray-400 line-through">{fmtPrice(originalTotal)}</span>
                )}
                <span className={`font-semibold ${totalSavings > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}>
                  {fmtPrice(total)}
                </span>
              </div>
            </div>
            {totalSavings > 0 && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                You save {fmtPrice(totalSavings)} with current sale prices.
              </p>
            )}
            <p className="text-[12px] sm:text-sm italic text-gray-400 dark:text-gray-500">
              Shipping, discounts & fees calculated at checkout.
            </p>
            <p className="p-2 sm:p-3 bg-amber-500/15 border-2 rounded-xl italic border-amber-500/50 text-[11px] sm:text-[15px] text-amber-700 dark:text-amber-400/80">
              Items might sell while in cart. Availability confirmed at time of purchase.
            </p>
            {/* CTA → /checkout */}
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="block w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-[12px] sm:text-sm font-medium text-center transition-colors"
            >
              Review Order →
            </Link>
            <button
              onClick={() => { clearCart(); closeDrawer(); }}
              className="w-full text-xs sm:text-sm text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-0.5"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
