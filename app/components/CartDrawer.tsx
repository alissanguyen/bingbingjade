"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartContext";

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

  const total = items.reduce((sum, i) => sum + i.price, 0);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Invisible click-outside trap */}
      <div
        ref={overlayRef}
        onClick={closeDrawer}
        className={`fixed inset-0 z-30 ${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-30 w-full max-w-sm bg-white dark:bg-gray-950 shadow-2xl flex flex-col"
        style={{
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
              <span className="text-5xl">🛍️</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your cart is empty.</p>
              <button
                onClick={closeDrawer}
                className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Continue browsing
              </button>
            </div>
          ) : (
            items.map((item) => {
              const productPath = item.productSlug
                ? `/products/${item.productSlug}-${item.productPublicId}`
                : `/products/${item.productPublicId}`;
              return (
                <div key={`${item.productId}-${item.optionId}`} className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    {item.thumbnail ? (
                      <Image
                        src={item.thumbnail}
                        alt={item.productName}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={productPath}
                      onClick={closeDrawer}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 line-clamp-2 leading-snug"
                    >
                      {item.productName}
                    </Link>
                    {item.optionLabel && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.optionLabel}</p>
                    )}
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                      ${item.price.toFixed(2)}
                    </p>
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
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-3">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">${total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Shipping and taxes calculated at checkout.
            </p>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 text-sm font-medium transition-colors"
            >
              {loading ? "Redirecting to checkout…" : "Checkout"}
            </button>
            <button
              onClick={() => { clearCart(); closeDrawer(); }}
              className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-1"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
