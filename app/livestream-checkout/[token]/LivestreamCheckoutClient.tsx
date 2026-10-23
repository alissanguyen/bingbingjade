"use client";

import { useState, useMemo } from "react";
import { ALLOWED_COUNTRIES } from "@/lib/shipping";
import { calculateLivestreamPricing } from "@/lib/livestream-pricing";

interface Props {
  token: string;
  item: {
    code: string;
    title: string;
    size: string | null;
    price: number;
    buyerHandle: string | null;
  };
}

export function LivestreamCheckoutClient({ token, item }: Props) {
  const [country, setCountry] = useState("US");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricing = useMemo(
    () => calculateLivestreamPricing(item.price, country, state),
    [item.price, country, state]
  );

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/livestream-checkout/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, state }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/livestream-checkout/${token}/cancel`, { method: "POST" });
      if (res.ok) {
        setCancelled(true);
      } else {
        const json = await res.json();
        setError(json.error ?? "Failed to cancel. Please contact us for help.");
        setCancelConfirm(false);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Claim Cancelled</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your claim has been released. If you change your mind, reach out via DM and we can re-send a link.
          </p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Shop
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">💚</p>
          <h1 className="text-xl font-semibold text-gray-900">Complete Your Claim</h1>
          {item.buyerHandle && (
            <p className="text-sm text-gray-500 mt-1">Hi @{item.buyerHandle}!</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          {/* Item summary */}
          <div className="pb-4 mb-4 border-b border-gray-100">
            <p className="text-xs font-mono font-bold text-emerald-600 mb-0.5">{item.code}</p>
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            {item.size && <p className="text-xs text-gray-500 mt-0.5">Size: {item.size}</p>}
            <p className="text-sm font-bold text-gray-900 mt-1.5">${item.price.toFixed(2)}</p>
          </div>

          {/* Shipping destination */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ship to</label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={country}
                onChange={(e) => { setCountry(e.target.value); setState(""); }}
              >
                {ALLOWED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {country === "US" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                <input
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase placeholder:normal-case"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="e.g. WA, CA, NY"
                  maxLength={2}
                />
              </div>
            )}
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm space-y-1.5 mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Item</span>
              <span className="tabular-nums">${pricing.itemPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span className="tabular-nums">
                {pricing.shipping === 0
                  ? <span className="text-emerald-600 font-medium">Free</span>
                  : `$${pricing.shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Transaction fee (5%)</span>
              <span className="tabular-nums">${pricing.txFee.toFixed(2)}</span>
            </div>
            {pricing.isWA && (
              <div className="flex justify-between text-gray-600">
                <span>WA Sales Tax (10.5%)</span>
                <span className="tabular-nums">${pricing.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200 mt-1">
              <span>Total</span>
              <span className="tabular-nums">${pricing.total.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl transition-colors"
          >
            {loading ? "Redirecting to checkout…" : `Proceed to Checkout · $${pricing.total.toFixed(2)}`}
          </button>
        </div>

        {/* Cancel */}
        {!cancelConfirm ? (
          <button
            onClick={() => setCancelConfirm(true)}
            className="w-full mt-3 py-2.5 text-sm text-gray-400 hover:text-gray-500 transition-colors"
          >
            Cancel my claim
          </button>
        ) : (
          <div className="mt-3 bg-white rounded-2xl border border-red-200 p-4 text-center">
            <p className="text-sm font-medium text-gray-800 mb-1">Release this item?</p>
            <p className="text-xs text-gray-500 mb-3">
              Your claim will be cancelled and the item returned. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg transition-colors"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button
                onClick={() => setCancelConfirm(false)}
                className="flex-1 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep my claim
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
