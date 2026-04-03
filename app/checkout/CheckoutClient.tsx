"use client";

import { useEffect, useState } from "react";
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

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function CheckoutClient() {
  const { items, removeFromCart, clearCart } = useCart();
  const router = useRouter();

  // Availability
  const [soldKeys, setSoldKeys] = useState<Set<string>>(new Set());
  const [staleKeys, setStaleKeys] = useState<Set<string>>(new Set());
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Shipping
  const [expedited, setExpedited] = useState(false);

  // Email
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  // Discount
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    source: string;
    amountCents: number;
    message: string;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  // Admin unlock (beta mode)
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(isLiveMode);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState(false);

  // Submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Redirect if cart is empty (only after check completes and no items at all)
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

  // Pricing
  const subtotal = availableItems.reduce((s, i) => s + i.price, 0);
  const originalTotal = availableItems.reduce((s, i) => s + (i.originalPrice ?? i.price), 0);
  const totalSavings = originalTotal - subtotal;
  const shippingBase = expedited ? 100 : 20;
  const shipping = availableItems.length > 0 ? shippingBase + (availableItems.length - 1) * 10 : 0;
  const discountDollars = appliedDiscount ? appliedDiscount.amountCents / 100 : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountDollars);
  const txFee = Math.round((discountedSubtotal + shipping) * 0.035 * 100) / 100;
  const grandTotal = Math.round((discountedSubtotal + shipping + txFee) * 100) / 100;

  const emailValid = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canCheckout = availableItems.length > 0 && adminUnlocked && emailValid;

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
        body: JSON.stringify({
          discountCode: discountCode.trim(),
          subtotalCents,
          ...(email.trim() ? { customerEmail: email.trim() } : {}),
        }),
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
          expedited,
          discountCode: discountCode.trim() || undefined,
          customerEmail: email.trim() || undefined,
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

  // Show skeleton while availability check runs
  if (!availabilityChecked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-sm text-gray-400 dark:text-gray-500">Verifying your cart…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-500 font-semibold mb-1.5">
            Secure Checkout
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Review Your Order
          </h1>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Confirm your selection before completing your purchase.
          </p>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-12 xl:gap-16 items-start">

          {/* ── LEFT: Items + form fields ─────────────────────── */}
          <div className="space-y-8">

            {/* Items header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Your Items
                {availableItems.length > 0 && (
                  <span className="ml-1.5 normal-case tracking-normal font-normal text-gray-400">
                    ({availableItems.length})
                  </span>
                )}
              </h2>
              {items.length > 0 && (
                <button
                  onClick={() => { clearCart(); router.push("/products"); }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Clear cart
                </button>
              )}
            </div>

            {/* Available items */}
            {availableItems.length > 0 && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                {availableItems.map((item) => {
                  const productPath = item.productSlug
                    ? `/products/${item.productSlug}-${item.productPublicId}`
                    : `/products/${item.productPublicId}`;
                  const isOnSale = item.originalPrice != null;
                  return (
                    <div key={`${item.productId}-${item.optionId}`} className="flex gap-4 p-5">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={item.productName}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={productPath}
                          className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors line-clamp-2 leading-snug"
                        >
                          {item.productName}
                        </Link>
                        {item.optionLabel && (
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.optionLabel}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-sm sm:text-base font-semibold ${isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {fmtPrice(item.price)}
                          </span>
                          {isOnSale && (
                            <span className="text-xs text-gray-400 line-through">{fmtPrice(item.originalPrice!)}</span>
                          )}
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(item.productId, item.optionId)}
                        aria-label={`Remove ${item.productName}`}
                        className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 self-start mt-0.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sold items */}
            {soldItems.map((item) => (
              <div key={`sold-${item.productId}-${item.optionId}`} className="flex gap-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                  {item.thumbnail ? (
                    <Image src={item.thumbnail} alt={item.productName} width={64} height={64} className="w-full h-full object-cover grayscale opacity-40" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-1">{item.productName}</p>
                  {item.optionLabel && <p className="text-xs text-gray-400 mt-0.5">{item.optionLabel}</p>}
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1.5">This piece is no longer available.</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.productId, item.optionId)}
                  className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors shrink-0 self-center font-medium"
                >
                  Remove
                </button>
              </div>
            ))}

            {/* Stale items */}
            {staleItems.map((item) => {
              const productPath = item.productSlug
                ? `/products/${item.productSlug}-${item.productPublicId}`
                : `/products/${item.productPublicId}`;
              return (
                <div key={`stale-${item.productId}-${item.optionId}`} className="flex gap-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    {item.thumbnail ? (
                      <Image src={item.thumbnail} alt={item.productName} width={64} height={64} className="w-full h-full object-cover opacity-50" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-1">{item.productName}</p>
                    {item.optionLabel && <p className="text-xs text-gray-400 mt-0.5">{item.optionLabel}</p>}
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1.5">
                      This item was updated —{" "}
                      <Link href={productPath} className="underline underline-offset-2">re-add it from the product page</Link>.
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId, item.optionId)}
                    className="text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors shrink-0 self-center font-medium"
                  >
                    Remove
                  </button>
                </div>
              );
            })}

            {/* ── Email field ──────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-3">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailTouched(true);
                    if (appliedDiscount) setAppliedDiscount(null);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="your@email.com"
                  className={`w-full rounded-xl border px-4 py-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow ${
                    emailTouched && email && !emailValid
                      ? "border-red-400 dark:border-red-600"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                {emailTouched && email && !emailValid ? (
                  <p className="mt-1.5 text-xs text-red-500">Please enter a valid email address.</p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    Optional. Used to apply subscriber discounts and send order confirmation.
                  </p>
                )}
              </div>

              {/* ── Discount / referral code ─────────────────── */}
              <div>
                <label htmlFor="discount" className="block text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-3">
                  Discount or Referral Code
                </label>
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
                    placeholder="CODE"
                    className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={applyDiscount}
                    disabled={discountLoading}
                    className="rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-5 py-3 text-sm font-medium transition-colors shrink-0"
                  >
                    {discountLoading ? "…" : "Apply"}
                  </button>
                </div>
                {appliedDiscount && (
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ {appliedDiscount.message}
                  </p>
                )}
                {discountError && (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400">{discountError}</p>
                )}
              </div>
            </div>

            {/* ── Admin unlock (beta mode only) ────────────── */}
            {!isLiveMode && (
              <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4">
                {adminUnlocked ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Admin access granted — checkout is unlocked.
                  </p>
                ) : !showAdminInput ? (
                  <button
                    onClick={() => setShowAdminInput(true)}
                    className="text-xs text-gray-300 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500 transition-colors"
                  >
                    Admin access
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">Enter admin password to unlock checkout</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setAdminError(false); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAdminUnlock(); }}
                        placeholder="Password"
                        className={`flex-1 rounded-xl border px-4 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500 ${adminError ? "border-red-400 dark:border-red-600" : "border-gray-200 dark:border-gray-700"}`}
                      />
                      <button
                        onClick={handleAdminUnlock}
                        className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                      >
                        Unlock
                      </button>
                    </div>
                    {adminError && <p className="text-xs text-red-500">Incorrect password.</p>}
                  </div>
                )}
              </div>
            )}

            {/* ── Back link (mobile) ────────────────────── */}
            <div className="lg:hidden">
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Continue Shopping
              </Link>
            </div>

          </div>{/* end LEFT */}

          {/* ── RIGHT: Sticky summary card ────────────────────── */}
          <div className="mt-8 lg:mt-0 lg:sticky lg:top-28">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">

              {/* Summary header */}
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                  Order Summary
                </h2>
              </div>

              <div className="px-6 py-5 space-y-4">

                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Subtotal{availableItems.length > 0 ? ` (${availableItems.length} ${availableItems.length === 1 ? "item" : "items"})` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {totalSavings > 0 && (
                      <span className="text-xs text-gray-400 line-through">{fmtPrice(originalTotal)}</span>
                    )}
                    <span className={`font-semibold ${totalSavings > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}>
                      {availableItems.length > 0 ? fmtPrice(subtotal) : "—"}
                    </span>
                  </div>
                </div>

                {/* Expedited toggle */}
                <div className="flex items-center justify-between py-1 border-t border-b border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Expedited Shipping</span>
                      <a
                        href="/faq#expedited-shipping"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors"
                      >
                        *Learn more
                      </a>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {expedited ? "$100 base + $10/item" : "$20 base + $10/item"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpedited((v) => !v)}
                    role="switch"
                    aria-checked={expedited}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${expedited ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${expedited ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>

                {/* Shipping line */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {expedited ? "Expedited" : "Standard"} Shipping
                    {availableItems.length > 1 ? ` (${availableItems.length} pieces)` : ""}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {availableItems.length > 0 ? fmtPrice(shipping) : "—"}
                  </span>
                </div>

                {/* Discount line */}
                {discountDollars > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">Discount</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      −{fmtPrice(discountDollars)}
                    </span>
                  </div>
                )}

                {/* Transaction fee */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Transaction Fee (3.5%)</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {availableItems.length > 0 ? fmtPrice(txFee) : "—"}
                  </span>
                </div>

                {/* Grand total */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {availableItems.length > 0 ? fmtPrice(grandTotal) : "—"}
                  </span>
                </div>

                {totalSavings > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center -mt-1">
                    You save {fmtPrice(totalSavings)} with current sale prices.
                  </p>
                )}

                {/* Zelle/wire note */}
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p>Items might sell while in cart — availability confirmed only at purchase.</p>
                  <p>
                    <span className="font-semibold">Prefer Zelle or Wire Transfer?</span>{" "}
                    Transaction fee waived — reach out before checking out.
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
                    type="button"
                    onClick={handleCheckout}
                    disabled={loading || !canCheckout}
                    className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 text-sm font-semibold tracking-wide transition-colors shadow-sm"
                  >
                    {loading ? "Redirecting to payment…" : "Complete Purchase"}
                  </button>
                ) : (
                  <div className="w-full rounded-full bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 py-3.5 text-sm font-semibold text-center cursor-not-allowed">
                    Checkout Unavailable
                  </div>
                )}

                {/* Back link (desktop) */}
                <Link
                  href="/products"
                  className="hidden lg:block text-center text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  ← Continue Shopping
                </Link>

              </div>{/* end summary body */}

              {/* Trust section */}
              <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-5 space-y-3.5">
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                    <LockIcon />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Secured by Stripe</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                      Your payment is encrypted end-to-end. We never store your card details.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                    <ShieldIcon />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Authenticity Guaranteed</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                      Every piece is natural Type A Jadeite — untreated, certified, and backed by our lifetime guarantee.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">
                    <BoxIcon />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Ships Within 3–5 Business Days</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                      Each order is carefully packaged and dispatched promptly. Expedited options available at checkout.
                    </p>
                  </div>
                </div>
              </div>

            </div>{/* end summary card */}
          </div>{/* end RIGHT */}

        </div>
      </div>
    </div>
  );
}
