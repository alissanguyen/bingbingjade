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

const isLiveMode = process.env.NEXT_PUBLIC_CHECKOUT_MODE === "live";

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(isLiveMode); // auto-unlocked in live mode
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const [soldKeys, setSoldKeys] = useState<Set<string>>(new Set());
  const [staleKeys, setStaleKeys] = useState<Set<string>>(new Set());
  const [expedited, setExpedited] = useState(false);
  // Discount state
  const [discountEmail, setDiscountEmail] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    source: string;
    amountCents: number;
    message: string;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset discount state when drawer closes or cart changes
  const cartKey = items.map((i) => `${i.productId}-${i.optionId}`).join(",");

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

  async function handleAdminUnlock() {
    const res = await fetch("/api/stripe/verify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    if (res.ok) {
      setAdminUnlocked(true);
      setShowAdminInput(false);
      setAdminError(false);
    } else {
      setAdminError(true);
    }
  }

  async function applyDiscount() {
    const email = discountEmail.trim();
    if (!email) {
      setDiscountError("Enter your email to apply a discount.");
      return;
    }
    setDiscountLoading(true);
    setDiscountError(null);
    setAppliedDiscount(null);
    try {
      const subtotalCents = Math.round(
        availableItems.reduce((s, i) => s + (i.price ?? 0), 0) * 100
      );
      const res = await fetch("/api/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email,
          discountCode: discountCode.trim() || undefined,
          subtotalCents,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({
          source: data.source,
          amountCents: data.discountAmountCents,
          message: data.displayMessage,
        });
      } else {
        setDiscountError(data.error ?? "No discount available.");
      }
    } catch {
      setDiscountError("Could not verify discount. Please try again.");
    } finally {
      setDiscountLoading(false);
    }
  }

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminUnlocked ? { "x-admin-password": adminPassword } : {}),
        },
        body: JSON.stringify({
          items: availableItems,
          expedited,
          customerEmail: discountEmail.trim() || undefined,
          discountCode: discountCode.trim() || undefined,
        }),
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
              {items.filter((item) => !soldKeys.has(`${item.productId}-${item.optionId}`)).map((item) => {
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
                          loading="eager"
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
                        className="text-[12px] sm:text-[17px] font-medium text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 line-clamp-2 leading-snug"
                      >
                        {item.productName}
                      </Link>
                      {item.optionLabel && (
                        <p className="text-[12px] sm:text-[17px] sm:text-[16px] text-gray-500 dark:text-gray-400 mt-0.5">{item.optionLabel}</p>
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
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-2">
            {error && (
              <p className="text-[12px] sm:text-[17px] text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-1.5">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between text-[12px] sm:text-[17px]">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <div className="flex items-center gap-2">
                {totalSavings > 0 && (
                  <span className="text-[12px] sm:text-[17px] text-gray-400 line-through">{fmtPrice(originalTotal)}</span>
                )}
                <span className={`font-semibold ${totalSavings > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}>
                  {fmtPrice(total)}
                </span>
              </div>
            </div>
            {/* Expedited shipping toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] sm:text-[17px] text-gray-700 dark:text-gray-300">Expedited Shipping</span>
                <a
                  href="/faq#expedited-shipping"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] sm:text-[13px] mb-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
                >
                  *Learn more
                </a>
              </div>
              <button
                type="button"
                onClick={() => setExpedited((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${expedited ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}
                role="switch"
                aria-checked={expedited}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${expedited ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>
            {/* Discount / referral code section */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Discount / Referral Code
              </p>
              <input
                type="email"
                value={discountEmail}
                onChange={(e) => {
                  setDiscountEmail(e.target.value);
                  setAppliedDiscount(null);
                  setDiscountError(null);
                }}
                placeholder="Your email address"
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-[11px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase());
                    setAppliedDiscount(null);
                    setDiscountError(null);
                  }}
                  placeholder="Code (optional)"
                  className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-[11px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={discountLoading || !discountEmail.trim()}
                  className="rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3 py-1.5 text-[11px] font-medium transition-colors shrink-0"
                >
                  {discountLoading ? "…" : "Apply"}
                </button>
              </div>
              {appliedDiscount && (
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ {appliedDiscount.message}
                </p>
              )}
              {discountError && (
                <p className="text-[10px] text-red-500 dark:text-red-400">{discountError}</p>
              )}
            </div>

            {(() => {
              const shippingBase = expedited ? 100 : 20;
              const shipping = availableItems.length > 0 ? shippingBase + (availableItems.length - 1) * 10 : 0;
              const discountDollars = appliedDiscount ? appliedDiscount.amountCents / 100 : 0;
              const discountedTotal = Math.max(0, total - discountDollars);
              const txFee = Math.round((discountedTotal + shipping) * 0.035 * 100) / 100;
              const grandTotal = Math.round((discountedTotal + shipping + txFee) * 100) / 100;
              const shippingLabel = expedited ? "Expedited Shipping" : "Shipping";
              return (
                <>
                  <div className="flex items-center justify-between text-[12px] sm:text-[17px]">
                    <span className="text-gray-500 dark:text-gray-400">
                      {shippingLabel}{availableItems.length > 1 ? ` (${availableItems.length} pieces)` : ""}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtPrice(shipping)}</span>
                  </div>
                  {discountDollars > 0 && (
                    <div className="flex items-center justify-between text-[12px] sm:text-[17px]">
                      <span className="text-emerald-600 dark:text-emerald-400">Discount</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">−{fmtPrice(discountDollars)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[12px] sm:text-[17px]">
                    <span className="text-gray-500 dark:text-gray-400">Transaction Fee <span className="text-[12px] sm:text-[17px]">(3.5%)</span></span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtPrice(txFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] sm:text-[17px] border-t border-gray-100 dark:border-gray-800 pt-1.5">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{fmtPrice(grandTotal)}</span>
                  </div>
                </>
              );
            })()}
            {totalSavings > 0 && (
              <p className="text-[12px] sm:text-[17px] text-emerald-600 dark:text-emerald-400 font-medium">
                You save {fmtPrice(totalSavings)} with current sale prices.
              </p>
            )}
            <div className="text-[10px] sm:text-[15px] rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 space-y-1">
              <p className="text-amber-800 dark:text-amber-300">
                Items might sell while in cart — availability confirmed only at checkout.
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                💳 <span className="font-semibold">Zelle / Wire Transfer</span>? Transaction fee waived — reach out before checking out.
              </p>
            </div>

            {adminUnlocked ? (
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 text-[12px] sm:text-[17px] font-medium transition-colors"
              >
                {loading ? "Redirecting to checkout…" : "Checkout"}
              </button>
            ) : (
              <div className="w-full rounded-full bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 py-2.5 text-[12px] sm:text-[17px] font-medium text-center cursor-not-allowed">
                Checkout unavailable
              </div>
            )}

            {/* Admin unlock — only shown in beta mode */}
            {!isLiveMode && !adminUnlocked && (
              <div className="pt-0">
                {!showAdminInput ? (
                  <button
                    onClick={() => setShowAdminInput(true)}
                    className="w-full text-[12px] sm:text-[17px] text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 transition-colors py-1"
                  >
                    Admin access
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => { setAdminPassword(e.target.value); setAdminError(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAdminUnlock(); }}
                      placeholder="Admin password"
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-[12px] sm:text-[17px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-emerald-500 ${adminError ? "border-red-400" : "border-gray-300 dark:border-gray-700"}`}
                    />
                    <button
                      onClick={handleAdminUnlock}
                      className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-[12px] sm:text-[17px] font-medium transition-colors"
                    >
                      Unlock
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { clearCart(); closeDrawer(); }}
              className="w-full text-[12px] sm:text-[17px] text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-1"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
