"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Elements, AddressElement } from "@stripe/react-stripe-js";
import type { StripeAddressElementChangeEvent } from "@stripe/stripe-js";
import { stripePromise } from "@/lib/stripe-client";
import { ALLOWED_COUNTRIES, getShippingZone, calculateShipping, calculateStripeFee, calculateBnplFee } from "@/lib/shipping";

interface Props {
  offerToken: string;
  sourcingToken: string;
  title: string;
  images: string[];
  priceCents: number;
  creditAppliedCents: number;
  customerEmail: string;
  expiresAt: string | null;
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<string | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export function SourcingCheckoutClient({
  offerToken,
  sourcingToken,
  title,
  images,
  priceCents,
  creditAppliedCents,
  customerEmail,
  expiresAt,
}: Props) {
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const countdown = useCountdown(expiresAt);

  // Dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Sticky CTA
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Address
  const [addressValue, setAddressValue] = useState<StripeAddressElementChangeEvent["value"] | null>(null);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"standard" | "bnpl" | null>(null);

  // Submit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived pricing
  const address = addressValue?.address;
  const zone = address?.country ? getShippingZone(address.country) : null;
  const shippingCents = zone != null ? calculateShipping(zone, 1) * 100 : null;

  // Credit capped to actual item + shipping total
  const effectiveCreditCents =
    shippingCents != null
      ? Math.min(creditAppliedCents, priceCents + shippingCents)
      : creditAppliedCents;

  const afterCreditCents =
    shippingCents != null
      ? Math.max(0, priceCents + shippingCents - effectiveCreditCents)
      : null;

  const txFeeCents =
    afterCreditCents != null && zone != null
      ? paymentMethod === "bnpl"
        ? calculateBnplFee(afterCreditCents)
        : calculateStripeFee(afterCreditCents, zone)
      : null;

  const totalCents =
    afterCreditCents != null && txFeeCents != null
      ? afterCreditCents + txFeeCents
      : null;

  const bnplEligible = address?.country === "US";
  useEffect(() => {
    if (paymentMethod === "bnpl" && !bnplEligible) setPaymentMethod("standard");
  }, [bnplEligible, paymentMethod]);

  const addressComplete = addressValue !== null;
  const canCheckout = addressComplete && paymentMethod !== null;

  async function handleCheckout() {
    if (!canCheckout || !addressValue) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sourcing/offer/${offerToken}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          shippingAddress: {
            name: addressValue.name,
            line1: addressValue.address.line1,
            ...(addressValue.address.line2 ? { line2: addressValue.address.line2 } : {}),
            city: addressValue.address.city,
            ...(addressValue.address.state ? { state: addressValue.address.state } : {}),
            postal: addressValue.address.postal_code,
            country: addressValue.address.country,
          },
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

  const thumbnail = images[0] ?? null;

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-gray-950">

      {/* ── Brand header ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-950 border-b border-stone-200/70 dark:border-gray-800/70">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-7 sm:py-9">
          {sourcingToken && (
            <Link
              href={`/custom-sourcing/${sourcingToken}`}
              className="inline-flex items-center gap-1.5 text-[12px] sm:text-[16px] tracking-widest uppercase text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors mb-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to my request
            </Link>
          )}
          <p className="text-[14px] sm:text-sm uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-500 font-semibold mb-3 sm:mb-6">
            Secure Checkout
          </p>
          <h1 className="text-2xl sm:text-[2rem] font-semibold tracking-tight text-stone-900 dark:text-gray-100 leading-tight">
            Complete Your Purchase
          </h1>
          <p className="mt-2 text-[12px] sm:text-sm text-stone-400 dark:text-gray-500">
            Reserved exclusively for {customerEmail}.
          </p>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-12 pb-32 lg:pb-12">
        <div className="lg:grid lg:grid-cols-[1fr_500px] lg:gap-10 xl:gap-14 items-start">

          {/* ── LEFT: Item ──────────────────────────────────────────── */}
          <div>
            <p className="text-[12px] sm:text-sm uppercase tracking-[0.25em] font-semibold text-stone-400 dark:text-gray-500 mb-6">
              Your Selection
            </p>

            {/* Item card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-stone-200/80 dark:border-gray-800/80 p-4 sm:p-5 flex gap-4 sm:gap-5 shadow-sm shadow-stone-100 dark:shadow-none">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-stone-100 dark:bg-gray-800 shrink-0">
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={title}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <p className="text-[13px] sm:text-base font-medium text-stone-900 dark:text-gray-100 leading-snug">
                  {title}
                </p>
                <div className="mt-3">
                  <span className="text-[15px] sm:text-base font-semibold tracking-tight text-emerald-800 dark:text-emerald-400">
                    {fmt(priceCents)}
                  </span>
                </div>
              </div>
            </div>

            {/* Image strip (if multiple) */}
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.slice(1, 5).map((src, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 dark:bg-gray-800 shrink-0">
                    <Image src={src} alt={`${title} view ${i + 2}`} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                  </div>
                ))}
              </div>
            )}

            {/* Expiry */}
            {countdown && (
              <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <p className="text-[12px] sm:text-sm text-amber-700 dark:text-amber-400">
                  This offer expires in <span className="font-semibold font-mono">{countdown}</span>
                </p>
              </div>
            )}

            {/* Credit notice */}
            {creditAppliedCents > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-[12px] sm:text-sm text-emerald-700 dark:text-emerald-400">
                  Your <span className="font-semibold">{fmt(creditAppliedCents)}</span> sourcing deposit is applied to this order.
                </p>
              </div>
            )}
          </div>

          {/* ── RIGHT: Summary + form ───────────────────────────────── */}
          <div className="mt-8 lg:mt-0 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-stone-200/80 dark:border-gray-800/80 bg-white dark:bg-gray-900 overflow-hidden shadow-lg shadow-stone-100/80 dark:shadow-none">

              {/* Card header */}
              <div className="p-4 pb-0 sm:p-6 border-b border-stone-100 dark:border-gray-800">
                <p className="text-[14px] sm:text-base uppercase tracking-[0.25em] font-semibold text-stone-400 dark:text-gray-500">
                  Order Summary
                </p>
              </div>

              <div className="p-4 sm:px-5 sm:py-4 space-y-4">

                {/* Item price row */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] sm:text-sm text-stone-500 dark:text-gray-400">Item</span>
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-500">{fmt(priceCents)}</span>
                </div>

                {/* Credit */}
                {creditAppliedCents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] sm:text-sm text-emerald-700 dark:text-emerald-400">Deposit credit</span>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">−{fmt(effectiveCreditCents)}</span>
                  </div>
                )}

                {/* ── Shipping address ───────────────────────────────── */}
                <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900/40 p-2.5 sm:p-3.5 space-y-2.5">
                  <p className="text-[11px] sm:text-[15px] uppercase tracking-[0.2em] font-semibold text-stone-400 dark:text-gray-500">
                    Shipping Address
                  </p>
                  <Elements
                    stripe={stripePromise}
                    options={{
                      appearance: isDark
                        ? {
                            variables: {
                              colorPrimary: "#34d399",
                              colorBackground: "#111827",
                              colorText: "#f3f4f6",
                              colorDanger: "#f87171",
                              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
                              borderRadius: "8px",
                              fontSizeBase: "13px",
                            },
                            rules: {
                              ".Input": { border: "1px solid #374151", boxShadow: "none", backgroundColor: "#111827", color: "#f3f4f6" },
                              ".Input:focus": { border: "1px solid #34d399", boxShadow: "0 0 0 2px rgba(52,211,153,0.2)", outline: "none" },
                              ".Label": { color: "#9ca3af", fontSize: "11px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase" },
                              ".Error": { color: "#f87171" },
                            },
                          }
                        : {
                            variables: {
                              colorPrimary: "#059669",
                              colorBackground: "#ffffff",
                              colorText: "#1c1917",
                              colorDanger: "#ef4444",
                              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
                              borderRadius: "8px",
                              fontSizeBase: "13px",
                            },
                            rules: {
                              ".Input": { border: "1px solid #e7e5e4", boxShadow: "none", backgroundColor: "#ffffff", color: "#1c1917" },
                              ".Input:focus": { border: "1px solid #059669", boxShadow: "0 0 0 2px rgba(5,150,105,0.2)", outline: "none" },
                              ".Label": { color: "#78716c", fontSize: "11px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase" },
                              ".Error": { color: "#ef4444" },
                            },
                          },
                    }}
                  >
                    <AddressElement
                      options={{
                        mode: "shipping",
                        allowedCountries: ALLOWED_COUNTRIES.map((c) => c.code),
                        fields: { phone: "never" },
                        defaultValues: { name: "", address: { country: "US" } },
                      }}
                      onChange={(e) => setAddressValue(e.complete ? e.value : null)}
                    />
                  </Elements>
                </div>

                {/* ── Payment method ─────────────────────────────────── */}
                <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900/40 p-2.5 sm:p-3.5 space-y-2">
                  <p className="text-[11px] sm:text-[15px] uppercase tracking-[0.2em] font-semibold text-stone-400 dark:text-gray-500">
                    Payment Method
                  </p>
                  <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === "standard" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-stone-200 dark:border-gray-700 hover:border-stone-300 dark:hover:border-gray-600"}`}>
                    <input type="radio" name="paymentMethod" value="standard" checked={paymentMethod === "standard"} onChange={() => setPaymentMethod("standard")} className="mt-0.5 accent-emerald-600" />
                    <div>
                      <p className="text-[13px] sm:text-sm font-semibold text-stone-800 dark:text-gray-200">Standard</p>
                      <p className="text-[11px] sm:text-[13px] text-stone-500 dark:text-gray-400 mt-0.5">Pay in full via credit or debit card</p>
                    </div>
                  </label>
                  {bnplEligible ? (
                    <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === "bnpl" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-stone-200 dark:border-gray-700 hover:border-stone-300 dark:hover:border-gray-600"}`}>
                      <input type="radio" name="paymentMethod" value="bnpl" checked={paymentMethod === "bnpl"} onChange={() => setPaymentMethod("bnpl")} className="mt-0.5 accent-emerald-600" />
                      <div>
                        <p className="text-[13px] sm:text-sm font-semibold text-stone-800 dark:text-gray-200">Pay in installments</p>
                        <p className="text-[11px] sm:text-[13px] text-stone-500 dark:text-gray-400 mt-0.5">Klarna, Afterpay — subject to eligibility</p>
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-stone-100 dark:border-gray-800 opacity-50">
                      <input type="radio" disabled className="mt-0.5" />
                      <div>
                        <p className="text-[13px] sm:text-sm font-semibold text-stone-500 dark:text-gray-500">Pay in installments</p>
                        <p className="text-[11px] sm:text-[13px] text-stone-400 dark:text-gray-600 mt-0.5">Only available for US shipping addresses</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Price breakdown ────────────────────────────────── */}
                <div className="border-t border-stone-100 dark:border-gray-800 pt-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[12px] sm:text-sm text-stone-500 dark:text-gray-400">Shipping</span>
                    <span className="text-[12px] sm:text-sm font-medium text-stone-900 dark:text-gray-100">
                      {shippingCents != null ? fmt(shippingCents) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[12px] sm:text-sm text-stone-500 dark:text-gray-400">
                      {paymentMethod === "bnpl" ? "Installment Fee" : "Transaction Fee"}
                    </span>
                    <span className="text-[12px] sm:text-sm font-medium text-stone-900 dark:text-gray-100">
                      {txFeeCents != null && paymentMethod !== null ? fmt(txFeeCents) : "—"}
                    </span>
                  </div>
                </div>

                {/* ── Grand total ────────────────────────────────────── */}
                <div className="border-t-2 border-stone-900 dark:border-gray-700 pt-4 flex items-center justify-between">
                  <span className="text-[13px] sm:text-[16px] uppercase tracking-[0.15em] font-semibold text-stone-500 dark:text-gray-400">Total</span>
                  <span className="text-[16px] sm:text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-500">
                    {totalCents != null && paymentMethod !== null ? fmt(totalCents) : "—"}
                  </span>
                </div>

                {/* Note */}
                <div className="text-[12px] sm:text-[16px] text-amber-600 dark:text-amber-500 space-y-1 leading-relaxed bg-amber-500/15 p-2 sm:p-4 rounded-lg">
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
                <button
                  ref={ctaRef}
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading || !canCheckout}
                  className="text-[14px] sm:text-sm w-full rounded-full bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 font-semibold tracking-wide transition-colors shadow-md shadow-emerald-900/20"
                >
                  {loading ? "Redirecting to payment…" : "Complete Purchase"}
                </button>

                {sourcingToken && (
                  <Link
                    href={`/custom-sourcing/${sourcingToken}`}
                    className="block text-center text-[12px] sm:text-sm text-stone-400 dark:text-gray-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    ← Back to my request
                  </Link>
                )}

              </div>

              {/* Trust badges */}
              <div className="border-t border-stone-100 dark:border-gray-800 px-6 py-5 space-y-3 bg-stone-50/50 dark:bg-gray-900/20">
                {[
                  { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", label: "Secure Payment", sub: "Encrypted via Stripe" },
                  { icon: "M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z", label: "All Major Cards Accepted", sub: "Visa, Mastercard, Amex, and more" },
                ].map(({ icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 dark:text-gray-500 shrink-0">
                      <path d={icon} />
                    </svg>
                    <div>
                      <p className="text-[12px] sm:text-sm font-medium text-stone-700 dark:text-gray-300">{label}</p>
                      <p className="text-[10px] sm:text-[13px] text-stone-400 dark:text-gray-500">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ── Mobile sticky bar ─────────────────────────────────────────── */}
      {showStickyBar && (
        <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-stone-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 py-3 safe-area-pb">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-stone-500 dark:text-gray-400">Total</span>
            <span className="text-[15px] font-semibold text-emerald-600 dark:text-emerald-500">
              {totalCents != null && paymentMethod !== null ? fmt(totalCents) : "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || !canCheckout}
            className="w-full rounded-full bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 text-sm font-semibold tracking-wide transition-colors"
          >
            {loading ? "Redirecting…" : "Complete Purchase"}
          </button>
        </div>
      )}

    </div>
  );
}
