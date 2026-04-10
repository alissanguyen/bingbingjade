"use client";

import { useState } from "react";
import Image from "next/image";

export interface EmailableProduct {
  id: string;
  name: string;
  category: string;
  slug: string;         // full slug-publicId
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  imageUrl: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelets", bangle: "Bangles", ring: "Rings",
  pendant: "Pendants", necklace: "Necklaces", set: "Sets",
  custom_order: "Custom Orders", other: "Other",
};

function catLabel(v: string) { return CATEGORY_LABELS[v] ?? v; }
function fmtPrice(p: number) { return `$${p.toFixed(2)}`; }

export function ProductEmailClient({
  products,
  subscriberCount,
}: {
  products: EmailableProduct[];
  subscriberCount: number;
}) {
  // Preselect most recent 4
  const defaultSelected = new Set(products.slice(0, 4).map((p) => p.id));
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  const [subject, setSubject] = useState("New arrivals at BingBing Jade");
  const [intro, setIntro] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSend() {
    if (selected.size === 0) { setError("Select at least one product."); return; }
    if (!subject.trim()) { setError("Subject is required."); return; }
    setError(null);

    const confirmed = confirm(
      `Send "${subject}" to ${subscriberCount.toLocaleString()} subscriber${subscriberCount !== 1 ? "s" : ""}?\n\n${selected.size} product${selected.size !== 1 ? "s" : ""} selected.`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    try {
      // Preserve display order (same as product list order)
      const productIds = products.filter((p) => selected.has(p.id)).map((p) => p.id);
      const res = await fetch("/api/admin/subscribers/product-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), intro: intro.trim(), productIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Send failed.");
      } else {
        setResult(data);
        showToast(`Sent to ${data.sent} subscriber${data.sent !== 1 ? "s" : ""}.${data.failed > 0 ? ` ${data.failed} failed.` : ""}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Email</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select products to feature and send a showcase email to all{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-200">{subscriberCount.toLocaleString()}</span>{" "}
          subscriber{subscriberCount !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* Compose */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Email Details</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. New arrivals at BingBing Jade"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Intro message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="A short message shown above the product grid…"
            />
          </div>
        </div>
      </section>

      {/* Product selection */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Select Products
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {selected.size} selected
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {products.map((p) => {
            const isSelected = selected.has(p.id);
            const isSold = p.status === "sold";
            const displayPrice = p.sale_price_usd ?? p.price_display_usd;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                  isSelected
                    ? "border-emerald-500 dark:border-emerald-400 ring-1 ring-emerald-500/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" sizes="200px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>
                  )}
                  {isSold && (
                    <div className="absolute top-1.5 left-1.5 bg-black text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      Sold
                    </div>
                  )}
                  {/* Checkmark */}
                  <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-emerald-500 text-white"
                      : "bg-white/80 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-600"
                  }`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                    {catLabel(p.category)}
                  </p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1">
                    {p.name}
                  </p>
                  {displayPrice != null && (
                    <p className={`text-xs font-medium ${isSold ? "text-gray-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {fmtPrice(displayPrice)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.
          {result.failed > 0 && ` ${result.failed} failed.`}
        </div>
      )}

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || selected.size === 0}
        className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white transition-colors"
      >
        {sending
          ? "Sending…"
          : `Send to ${subscriberCount.toLocaleString()} subscriber${subscriberCount !== 1 ? "s" : ""}`}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
