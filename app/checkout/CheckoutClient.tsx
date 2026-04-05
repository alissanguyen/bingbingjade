"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/components/CartContext";
import { supabase } from "@/lib/supabase";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";

const isLiveMode = process.env.NEXT_PUBLIC_CHECKOUT_MODE === "live";

function fmtPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CheckoutClient() {
  const { items, removeFromCart, clearCart, drawerOpen } = useCart();
  const router = useRouter();
  const ctaRef = useRef<HTMLElement>(null);

  // Availability
  const [soldKeys, setSoldKeys] = useState<Set<string>>(new Set());
  const [staleKeys, setStaleKeys] = useState<Set<string>>(new Set());
  const [quickShipIds, setQuickShipIds] = useState<Set<string>>(new Set());
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Shipping — Priority Sourcing upgrade (only for sourced_for_you items)
  const [prioritySourcing, setPrioritySourcing] = useState(false);

  // Shipping insurance (5% of item subtotal)
  const [shippingInsurance, setShippingInsurance] = useState(false);

  // Discount
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    source: string;
    amountCents: number;
    message: string;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  // Sourcing credit
  const [sourcingId, setSourcingId] = useState("");
  const [appliedSourcingCredit, setAppliedSourcingCredit] = useState<{
    requestId: string;
    availableCents: number;
  } | null>(null);
  const [sourcingCreditError, setSourcingCreditError] = useState<string | null>(null);
  const [sourcingCreditLoading, setSourcingCreditLoading] = useState(false);

  // Admin unlock (beta mode)
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(isLiveMode);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState(false);

  // Submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile sticky bar — visible when CTA is scrolled off-screen
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [availabilityChecked]);

  // Check live availability on mount
  useEffect(() => {
    if (items.length === 0) {
      setAvailabilityChecked(true);
      return;
    }
    async function checkAvailability() {
      const productIds = [...new Set(items.map((i) => i.productId))];
      const optionIds = items.map((i) => i.optionId).filter((id): id is string => id !== null);

      const [{ data: products }, { data: options }] = await Promise.all([
        supabase.from("products").select("id, status, quick_ship").in("id", productIds),
        optionIds.length > 0
          ? supabase.from("product_options").select("id, status").in("id", optionIds)
          : Promise.resolve({ data: [] }),
      ]);

      const productStatus = new Map(products?.map((p: { id: string; status: string; quick_ship: boolean }) => [p.id, p.status]) ?? []);
      setQuickShipIds(new Set(products?.filter((p: { id: string; status: string; quick_ship: boolean }) => p.quick_ship).map((p: { id: string; status: string; quick_ship: boolean }) => p.id) ?? []));
      const optionStatus = new Map((options ?? []).map((o: { id: string; status: string }) => [o.id, o.status]));

      const sold = new Set<string>();
      const stale = new Set<string>();
      for (const item of items) {
        const key = `${item.productId}-${item.optionId}`;
        if (item.optionId !== null) {
          if (optionStatus.get(item.optionId) === "sold") {
            sold.add(key);
          } else if (!optionStatus.has(item.optionId)) {
            if (productStatus.get(item.productId) === "sold") sold.add(key);
            else stale.add(key);
          }
        } else {
          if (productStatus.get(item.productId) === "sold") sold.add(key);
        }
      }
      setSoldKeys(sold);
      setStaleKeys(stale);
      setAvailabilityChecked(true);
    }
    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if cart is empty after check
  useEffect(() => {
    if (availabilityChecked && items.length === 0) {
      router.replace("/products");
    }
  }, [availabilityChecked, items.length, router]);

  const availableItems = items.filter(
    (i) => !soldKeys.has(`${i.productId}-${i.optionId}`) && !staleKeys.has(`${i.productId}-${i.optionId}`)
  );
  const soldItems = items.filter((i) => soldKeys.has(`${i.productId}-${i.optionId}`));
  const staleItems = items.filter((i) => staleKeys.has(`${i.productId}-${i.optionId}`));

  // Group available items by fulfillment type
  const getItemFulfillmentType = (item: (typeof items)[number]) =>
    item.fulfillmentType ?? (quickShipIds.has(item.productId) || item.quickShip ? "available_now" : "sourced_for_you");
  const availableNowItems = availableItems.filter((i) => getItemFulfillmentType(i) === "available_now");
  const sourcedForYouItems = availableItems.filter((i) => getItemFulfillmentType(i) === "sourced_for_you");
  const isMixedCart = availableNowItems.length > 0 && sourcedForYouItems.length > 0;
  const hasSourcingItems = sourcedForYouItems.length > 0;

  // Pricing
  const subtotal = availableItems.reduce((s, i) => s + i.price, 0);
  const originalTotal = availableItems.reduce((s, i) => s + (i.originalPrice ?? i.price), 0);
  const totalSavings = originalTotal - subtotal;
  // Priority Sourcing ($100 base) only applies when there are sourced_for_you items
  const shippingBase = (prioritySourcing && hasSourcingItems) ? 100 : 20;
  const shipping = availableItems.length > 0 ? shippingBase + (availableItems.length - 1) * 10 : 0;
  const discountDollars = appliedDiscount ? appliedDiscount.amountCents / 100 : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountDollars);
  // Insurance is 5% of item subtotal (before discount — covers declared item value)
  const insuranceFee = shippingInsurance && availableItems.length > 0
    ? Math.round(subtotal * 0.05 * 100) / 100
    : 0;
  const txFee = Math.round((discountedSubtotal + insuranceFee + shipping) * 0.035 * 100) / 100;
  // Sourcing credit applied against grand total (never below 0)
  const sourcingCreditAvailableDollars = appliedSourcingCredit ? appliedSourcingCredit.availableCents / 100 : 0;
  const grandTotalBeforeCredit = Math.round((discountedSubtotal + insuranceFee + shipping + txFee) * 100) / 100;
  const sourcingCreditApplied = Math.min(sourcingCreditAvailableDollars, grandTotalBeforeCredit);
  const grandTotal = Math.max(0, Math.round((grandTotalBeforeCredit - sourcingCreditApplied) * 100) / 100);

  const canCheckout = availableItems.length > 0 && adminUnlocked;

  function handleRemove(productId: string, optionId: string | null) {
    removeFromCart(productId, optionId);
    setAppliedDiscount(null);
    setDiscountError(null);
  }

  async function applyDiscount() {
    if (!discountCode.trim()) {
      setDiscountError("Please enter a discount or referral code.");
      return;
    }
    setDiscountLoading(true);
    setDiscountError(null);
    setAppliedDiscount(null);
    try {
      const subtotalCents = Math.round(subtotal * 100);
      const res = await fetch("/api/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountCode: discountCode.trim(), subtotalCents }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({ source: data.source, amountCents: data.discountAmountCents, message: data.displayMessage });
      } else {
        setDiscountError(data.error ?? "No discount available for this code.");
      }
    } catch {
      setDiscountError("Could not verify the code. Please try again.");
    } finally {
      setDiscountLoading(false);
    }
  }

  async function applySourcingCredit() {
    const id = sourcingId.trim();
    if (!id) {
      setSourcingCreditError("Please enter your sourcing request ID.");
      return;
    }
    setSourcingCreditLoading(true);
    setSourcingCreditError(null);
    setAppliedSourcingCredit(null);
    try {
      const res = await fetch("/api/sourcing/validate-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcingRequestId: id }),
      });
      const data = await res.json();
      if (res.ok && data.availableCents > 0) {
        setAppliedSourcingCredit({ requestId: id, availableCents: data.availableCents });
      } else {
        setSourcingCreditError(data.error ?? "No available credit found for this ID.");
      }
    } catch {
      setSourcingCreditError("Could not verify credit. Please try again.");
    } finally {
      setSourcingCreditLoading(false);
    }
  }

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

  async function handleCheckout() {
    if (!canCheckout) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminUnlocked && !isLiveMode ? { "x-admin-password": adminPassword } : {}),
        },
        body: JSON.stringify({
          items: availableItems,
          expedited: prioritySourcing && hasSourcingItems,
          shippingInsurance,
          discountCode: discountCode.trim() || undefined,
          sourcingRequestId: appliedSourcingCredit?.requestId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!availabilityChecked) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          <p className="text-[12px] sm:text-[16px] tracking-widest uppercase text-stone-400">Verifying your cart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0c0b12]">

      {/* ── Brand header ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0c0b12] border-b border-stone-200/70 dark:border-stone-800/70">
        {/* Thin emerald accent line */}
        <div className="bg-linear-to-r from-emerald-700 via-emerald-500 to-emerald-700 opacity-80 h-full" />
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-7 sm:py-9">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-[12px] sm:text-[16px] tracking-widest uppercase text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors mb-6"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Continue Shopping
          </Link>
          <p className="text-[14px] sm:text-sm uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-500 font-semibold mb-3 sm:mb-6">
            Secure Checkout
          </p>
          <h1 className="text-2xl sm:text-[2rem] font-semibold tracking-tight text-stone-900 dark:text-stone-100 leading-tight">
            Review Your Order
          </h1>
          <p className="mt-2 text-[12px] sm:text-sm text-stone-400 dark:text-stone-500">
            Confirm your selection before completing your purchase.
          </p>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8 sm:py-12 pb-32 lg:pb-12">
        <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-14 xl:gap-20 items-start">

          {/* ── LEFT: Pure item gallery ───────────────────────── */}
          <div>
            {/* Section label */}
            <div className="flex items-center justify-between mb-6 text-[12px] sm:text-sm">
              <p className="text-[12px] sm:text-sm uppercase tracking-[0.25em] font-semibold text-stone-400 dark:text-stone-500">
                Your Selection
                {availableItems.length > 0 && (
                  <span className="ml-1.5 font-normal">· {availableItems.length} {availableItems.length === 1 ? "piece" : "pieces"}</span>
                )}
              </p>
              {items.length > 0 && (
                <button
                  onClick={() => { clearCart(); router.push("/products"); }}
                  className="text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors tracking-wide"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Mixed cart notice */}
            {isMixedCart && (
              <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-[12px] sm:text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
                This order contains both <strong>Available Now</strong> and <strong>Sourced for You</strong> pieces. They will ship separately at their respective timelines.
              </div>
            )}

            {/* Available items — grouped by fulfillment type */}
            {(() => {
              const renderItemCard = (item: (typeof availableItems)[number]) => {
                const productPath = item.productSlug
                  ? `/products/${item.productSlug}-${item.productPublicId}`
                  : `/products/${item.productPublicId}`;
                const isOnSale = item.originalPrice != null;
                const isAvailableNow = getItemFulfillmentType(item) === "available_now";
                return (
                  <div
                    key={`${item.productId}-${item.optionId}`}
                    className="group bg-white dark:bg-[#141414] rounded-2xl border border-stone-200/80 dark:border-stone-800/80 p-4 sm:p-5 flex gap-4 sm:gap-5 shadow-sm shadow-stone-100 dark:shadow-none"
                  >
                    <Link href={productPath} className="shrink-0">
                      <div className="w-25 h-25 sm:w-30 sm:h-30 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={item.productName}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-stone-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <Link
                          href={productPath}
                          className="block text-[14px] sm:text-base font-medium text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors line-clamp-2 leading-snug"
                        >
                          {item.productName}
                        </Link>
                        {item.optionLabel && (
                          <p className="text-[12px] sm:text-[16px] text-stone-400 dark:text-stone-500 mt-1 tracking-wide">{item.optionLabel}</p>
                        )}
                        {isAvailableNow && (
                          <div
                            className="inline-flex items-center gap-1 bg-sky-200/65 dark:bg-sky-900 border border-sky-300/60 dark:border-sky-400/60 text-sky-600 dark:text-sky-300 text-[10px] sm:text-[14px] font-semibold px-2 py-0.5 rounded-full mt-1"
                            style={{ boxShadow: "0 0 6px 1px rgba(56,189,248,0.3)" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                            Available Now
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={`text-[15px] sm:text-base font-semibold tracking-tight ${isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-800 dark:text-emerald-400"}`}>
                          {fmtPrice(item.price)}
                        </span>
                        {isOnSale && item.originalPrice != null && (
                          <>
                            <span className="text-[12px] sm:text-base text-stone-400 line-through">{fmtPrice(item.originalPrice)}</span>
                            <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-[10px] sm:text-[16px] font-semibold px-1.5 py-0.5 rounded-full">
                              −{Math.round((1 - item.price / item.originalPrice) * 100)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.productId, item.optionId)}
                      aria-label={`Remove ${item.productName}`}
                      className="self-start mt-1 p-1.5 rounded-lg text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0"
                    >
                      <XIcon />
                    </button>
                  </div>
                );
              };

              return (
                <div className="space-y-3 mt-6">
                  {isMixedCart && availableNowItems.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                      <span className="text-[13px] sm:text-[15px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">Available Now</span>
                      <span className="text-[10px] sm:text-[14px] text-stone-400">· Ships in 2–5 business days</span>
                    </div>
                  )}
                  {availableNowItems.map(renderItemCard)}

                  {isMixedCart && sourcedForYouItems.length > 0 && (
                    <div className="flex items-center gap-2 pt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <span className="text-[13px] sm:text-[15px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Sourced for You</span>
                      <span className="text-[10px] sm:text-[14px] text-stone-400">· Arrives in 2–4 weeks</span>
                    </div>
                  )}
                  {sourcedForYouItems.map(renderItemCard)}
                </div>
              );
            })()}

            {/* Sold items */}
            {soldItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {soldItems.map((item) => (
                  <div key={`sold-${item.productId}-${item.optionId}`} className="bg-white dark:bg-[#141414] rounded-2xl border border-red-200 dark:border-red-900/60 p-4 flex gap-4 opacity-75">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
                      {item.thumbnail && (
                        <Image src={item.thumbnail} alt={item.productName} width={64} height={64} className="w-full h-full object-cover grayscale opacity-40" unoptimized />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-500 dark:text-stone-400 line-clamp-1">{item.productName}</p>
                      {item.optionLabel && <p className="text-[12px] sm:text-[16px] text-stone-400 mt-0.5">{item.optionLabel}</p>}
                      <p className="text-[12px] sm:text-[16px] text-red-500 dark:text-red-400 mt-1.5">This piece is no longer available.</p>
                    </div>
                    <button onClick={() => removeFromCart(item.productId, item.optionId)} className="self-center text-[12px] text-red-400 hover:text-red-600 transition-colors font-medium shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Stale items */}
            {staleItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {staleItems.map((item) => {
                  const productPath = item.productSlug
                    ? `/products/${item.productSlug}-${item.productPublicId}`
                    : `/products/${item.productPublicId}`;
                  return (
                    <div key={`stale-${item.productId}-${item.optionId}`} className="bg-white dark:bg-[#141414] rounded-2xl border border-amber-200 dark:border-amber-800/60 p-4 flex gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
                        {item.thumbnail && (
                          <Image src={item.thumbnail} alt={item.productName} width={64} height={64} className="w-full h-full object-cover opacity-50" unoptimized />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-500 dark:text-stone-400 line-clamp-1">{item.productName}</p>
                        {item.optionLabel && <p className="text-[12px] sm:text-[16px] text-stone-400 mt-0.5">{item.optionLabel}</p>}
                        <p className="text-[12px] sm:text-[16px] text-amber-600 dark:text-amber-400 mt-1.5">
                          Updated —{" "}
                          <Link href={productPath} className="underline underline-offset-2">re-add from product page</Link>.
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.productId, item.optionId)} className="self-center text-[12px] text-amber-500 hover:text-amber-700 transition-colors font-medium shrink-0">
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Admin unlock — only in beta mode */}
            {!isLiveMode && (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-[#141414] px-5 py-4">
                {adminUnlocked ? (
                  <p className="text-[12px] sm:text-base text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Admin access granted — checkout is unlocked.
                  </p>
                ) : !showAdminInput ? (
                  <button
                    onClick={() => setShowAdminInput(true)}
                    className="text-[12px] sm:text-[16px] text-stone-300 dark:text-stone-700 hover:text-stone-400 transition-colors"
                  >
                    Admin access
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[12px] sm:text-[16px] text-stone-400 font-medium">Enter admin password to unlock checkout</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setAdminError(false); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAdminUnlock(); }}
                        placeholder="Password"
                        className={`flex-1 rounded-xl border px-4 py-2.5 text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500 ${adminError ? "border-red-400" : "border-stone-200 dark:border-stone-700"}`}
                      />
                      <button
                        onClick={handleAdminUnlock}
                        className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                      >
                        Unlock
                      </button>
                    </div>
                    {adminError && <p className="text-[12px] sm:text-[16px] text-red-500">Incorrect password.</p>}
                  </div>
                )}
              </div>
            )}

            {/* Sale savings callout */}
            {totalSavings > 0 && (
              <div className="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/40 border border-emerald-300/50 dark:border-emerald-900/50">
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <p className="text-[12px] sm:text-base text-emerald-700 dark:text-emerald-400 font-medium">
                  You save <span className="font-bold">{fmtPrice(totalSavings)}</span> with current sale pricing.
                </p>
              </div>
            )}
          </div>{/* end LEFT */}

          {/* ── RIGHT: Summary + action ───────────────────────── */}
          <div className="mt-8 lg:mt-0 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-[#141414] overflow-hidden shadow-lg shadow-stone-100/80 dark:shadow-none">

              {/* Card header */}
              <div className="p-4 pb-0 sm:p-6 border-b border-stone-100 dark:border-stone-800">
                <p className="text-[14px] sm:text-base uppercase tracking-[0.25em] font-semibold text-stone-400 dark:text-stone-500">
                  Order Summary
                </p>
              </div>

              <div className="p-4 sm:px-6 sm:py-5 space-y-5">

                {/* Subtotal row */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] sm:text-sm text-stone-500 dark:text-stone-400">
                    Subtotal{availableItems.length > 0 ? ` · ${availableItems.length} ${availableItems.length === 1 ? "piece" : "pieces"}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {totalSavings > 0 && (
                      <span className="text-sm text-stone-400 line-through">{fmtPrice(originalTotal)}</span>
                    )}
                    <span className={`text-sm font-semibold ${totalSavings > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-500"}`}>
                      {availableItems.length > 0 ? fmtPrice(subtotal) : "—"}
                    </span>
                  </div>
                </div>

                {/* ── Discount field ──────────────────────── */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40 p-2.5 sm:p-3.5 space-y-2.5">
                  <p className="text-[11px] sm:text-[15px] uppercase tracking-[0.2em] font-semibold text-stone-400 dark:text-stone-500">
                    Discount or Referral Code
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="discount"
                      type="text"
                      autoComplete="off"
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value.toUpperCase());
                        setAppliedDiscount(null);
                        setDiscountError(null);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") applyDiscount(); }}
                      placeholder="Enter code"
                      className="text-[11px] sm:text-[14px] flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 sm:px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow w-full"
                    />
                    <button
                      type="button"
                      onClick={applyDiscount}
                      disabled={discountLoading}
                      className="text-[11px] sm:text-[15px] rounded-lg border border-emerald-700 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-700 dark:hover:text-white disabled:opacity-40 px-2 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0"
                    >
                      {discountLoading ? "…" : "Apply"}
                    </button>
                  </div>
                  {appliedDiscount && (
                    <p className="text-[12px] sm:text-[16px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {appliedDiscount.message}
                    </p>
                  )}
                  {discountError && (
                    <p className="text-[12px] text-red-500 dark:text-red-400">{discountError}</p>
                  )}
                </div>

                {/* ── Sourcing credit ─────────────────────��── */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40 p-2.5 sm:p-3.5 space-y-2.5">
                  <p className="text-[11px] sm:text-[15px] uppercase tracking-[0.2em] font-semibold text-stone-400 dark:text-stone-500">
                    Sourcing Credit
                  </p>
                  {appliedSourcingCredit ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] sm:text-[16px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        ${(appliedSourcingCredit.availableCents / 100).toFixed(2)} credit applied
                      </p>
                      <button
                        type="button"
                        onClick={() => { setAppliedSourcingCredit(null); setSourcingId(""); }}
                        className="text-[11px] text-stone-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          autoComplete="off"
                          value={sourcingId}
                          onChange={(e) => { setSourcingId(e.target.value); setSourcingCreditError(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") applySourcingCredit(); }}
                          placeholder="Sourcing request ID"
                          className="text-[11px] sm:text-[14px] flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 sm:px-3 py-2 text-sm font-mono text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow w-full"
                        />
                        <button
                          type="button"
                          onClick={applySourcingCredit}
                          disabled={sourcingCreditLoading}
                          className="text-[11px] sm:text-[15px] rounded-lg border border-emerald-700 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white dark:hover:bg-emerald-700 dark:hover:text-white disabled:opacity-40 px-2 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0"
                        >
                          {sourcingCreditLoading ? "…" : "Apply"}
                        </button>
                      </div>
                      <p className="text-[10px] sm:text-[13px] text-stone-400 dark:text-stone-500">
                        From a Custom Sourcing deposit — find your ID in your confirmation email.
                      </p>
                      {sourcingCreditError && (
                        <p className="text-[12px] text-red-500 dark:text-red-400">{sourcingCreditError}</p>
                      )}
                    </>
                  )}
                </div>

                {/* ── Priority Sourcing toggle (only for sourced_for_you items) ── */}
                {hasSourcingItems && (
                  <div className="flex items-center justify-between py-0.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] sm:text-sm text-stone-700 dark:text-stone-300">Priority Sourcing</span>
                        <a
                          href="/faq#expedited-sourcing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[8px] sm:text-[12px] text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
                        >
                          learn more
                        </a>
                      </div>
                      <p className="text-[12px] sm:text-sm text-stone-400 dark:text-stone-500 mt-0.5">
                        {prioritySourcing ? "$100 base + $10 per piece" : "$20 base + $10 per piece"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrioritySourcing((v) => !v)}
                      role="switch"
                      aria-checked={prioritySourcing}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${prioritySourcing ? "bg-emerald-600" : "bg-stone-200 dark:bg-stone-700"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${prioritySourcing ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                )}

                {/* ── Shipping insurance toggle ────────────── */}
                {availableItems.length > 0 && (
                  <div className="flex items-center justify-between py-0.5">
                    <div>
                      <p className="text-[12px] sm:text-sm text-stone-700 dark:text-stone-300">Shipping Insurance</p>
                      <p className="text-[12px] sm:text-sm text-stone-400 dark:text-stone-500 mt-0.5">
                        5% of item value · covers loss &amp; damage in transit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShippingInsurance((v) => !v)}
                      role="switch"
                      aria-checked={shippingInsurance}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${shippingInsurance ? "bg-emerald-600" : "bg-stone-200 dark:bg-stone-700"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${shippingInsurance ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>
                )}

                {/* ── Line items ───────────────────────────── */}
                <div className="border-t border-stone-100 dark:border-stone-800 pt-4 space-y-2.5">
                  {discountDollars > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[14px] sm:text-sm text-emerald-700 dark:text-emerald-400">Discount applied</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">−{fmtPrice(discountDollars)}</span>
                    </div>
                  )}

                  {insuranceFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[14px] sm:text-sm text-stone-500 dark:text-stone-400">Shipping Insurance · 5%</span>
                      <span className="text-[14px] sm:text-sm font-medium text-stone-900 dark:text-stone-100">{fmtPrice(insuranceFee)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-[14px] sm:text-sm text-stone-500 dark:text-stone-400">
                      {(prioritySourcing && hasSourcingItems) ? "Priority Sourcing" : "Standard"} Shipping
                      {availableItems.length > 1 ? ` · ${availableItems.length} pieces` : ""}
                    </span>
                    <span className="text-[14px] sm:text-sm font-medium text-stone-900 dark:text-stone-100">
                      {availableItems.length > 0 ? fmtPrice(shipping) : "—"}
                    </span>
                  </div>

                  {sourcingCreditApplied > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[14px] sm:text-sm text-emerald-700 dark:text-emerald-400">Sourcing Credit</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">−{fmtPrice(sourcingCreditApplied)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-[14px] sm:text-sm text-stone-500 dark:text-stone-400">Transaction Fee · 3.5%</span>
                    <span className="text-[14px] sm:text-sm font-medium text-stone-900 dark:text-stone-100">
                      {availableItems.length > 0 ? fmtPrice(txFee) : "—"}
                    </span>
                  </div>
                </div>

                {/* ── Grand total ──────────────────────────── */}
                <div className="border-t-2 border-stone-900 dark:border-stone-200 pt-4 flex items-center justify-between">
                  <span className="text-[13px] sm:text-[16px] uppercase tracking-[0.15em] font-semibold text-stone-500 dark:text-stone-400">Total</span>
                  <span className="text-[16px] sm:text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-500">
                    {availableItems.length > 0 ? fmtPrice(grandTotal) : "—"}
                  </span>
                </div>

                {/* Notes */}
                <div className="text-[12px] sm:text-[16px] text-amber-600 dark:text-amber-500 space-y-1 leading-relaxed bg-amber-500/15 p-2 sm:p-4 rounded-lg border-1">
                  <p>Item might sell while in cart. Availability confirmed at time of purchase.</p>
                  <p>
                    <span className="text-orange-700 dark:text-orange-600 font-semibold italic">Prefer Zelle or Wire?</span>{" "}
                    Transaction fee <span className="font-bold text-emerald-600">waived</span> — reach out before checking out.
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                {/* CTA */}
                {adminUnlocked ? (
                  <button
                    ref={ctaRef as React.RefObject<HTMLButtonElement>}
                    type="button"
                    onClick={handleCheckout}
                    disabled={loading || !canCheckout}
                    className="text-[14px] sm:text-sm w-full rounded-full bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 text-sm font-semibold tracking-wide transition-colors shadow-md shadow-emerald-900/20"
                  >
                    {loading ? "Redirecting to payment…" : "Complete Purchase"}
                  </button>
                ) : (
                  <div
                    ref={ctaRef as React.RefObject<HTMLDivElement & HTMLButtonElement>}
                    className="text-[14px] sm:text-sm w-full rounded-full bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 py-4 text-sm font-semibold text-center cursor-not-allowed"
                  >
                    Checkout Unavailable
                  </div>
                )}

                <Link
                  href="/products"
                  className="block text-center text-[12px] sm:text-sm text-stone-400 dark:text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  ← Continue Shopping
                </Link>

              </div>{/* end card body */}

              {/* Trust badges */}
              <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-5 space-y-4 bg-stone-50/50 dark:bg-stone-900/20">
                {[
                  {
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ),
                    title: "Secured by Stripe",
                    body: "Your payment is encrypted end-to-end. We never store your card details.",
                  },
                  {
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    ),
                    title: "Authenticity Guaranteed",
                    body: "Natural Type A Jadeite — untreated, certified, backed by our lifetime guarantee.",
                  },
                  {
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                    ),
                    title: "Orders Processed within 1-2 Business Days",
                    body: "Each order is carefully packaged. Expedited options available.",
                  },
                ].map((badge) => (
                  <div key={badge.title} className="flex items-start gap-3">
                    <span className="text-emerald-600 dark:text-emerald-500 shrink-0 mt-1">{badge.icon}</span>
                    <div>
                      <p className="text-[12px] sm:text-[17px] font-semibold text-stone-700 dark:text-stone-300">{badge.title}</p>
                      <p className="text-[11px] sm:text-[15px] text-stone-400 dark:text-stone-500 mt-0.5">{badge.body}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>{/* end summary card */}
          </div>{/* end RIGHT */}

        </div>
      </div>

      {/* ── Mobile sticky bottom bar ─────────────────────────── */}
      {/* Shows when the main CTA scrolls off-screen on mobile */}
      <div
        className={`lg:hidden fixed bottom-0 inset-x-0 transition-transform duration-300 ease-in-out ${drawerOpen ? "z-20" : "z-50"} ${showStickyBar && canCheckout ? "translate-y-0" : "translate-y-full"
          }`}
      >
        {/* Gradient fade above the bar */}
        <div className="h-8 bg-gradient-to-t from-[#faf9f7] dark:from-[#0d0d0d] to-transparent pointer-events-none" />
        <div className="bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Total</p>
              <p className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                {fmtPrice(grandTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              className="rounded-full bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-50 text-white px-6 py-3 text-sm font-semibold transition-colors shadow-md shadow-emerald-900/20 shrink-0"
            >
              {loading ? "Processing…" : "Complete Purchase"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
