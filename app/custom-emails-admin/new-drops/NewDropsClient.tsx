"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { SubscriberPicker } from "../SubscriberPicker";

export type { PickerSubscriber } from "../SubscriberPicker";

const SUBJECT_OPTIONS = [
  "New Jadeite Arrivals — One of One at BingBing Jade",
  "New In: Natural Jadeite, Just Released at BingBing Jade",
  "Our Latest Jadeite Pieces Are Live at BingBing Jade",
  "A New Selection of Jadeite Has Arrived at BingBing Jade",
  "Freshly Curated Jadeite Pieces at BingBing Jade",
  "New Season, New Jadeite at BingBing Jade",
  "Just Dropped — New Jadeite Pieces at BingBing Jade",
  "New Jadeite — Before It's Gone at BingBing Jade",
  "New Arrivals Are Selling Fast at BingBing Jade",
  "Just Released: One-of-a-Kind Jadeite at BingBing Jade",
  "These Won't Last — New Jadeite In at BingBing Jade",
  "You Might Fall in Love With These New Pieces at BingBing Jade",
  "Your Next Jade Piece Might Be Here at BingBing Jade",
];

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelets", bangle: "Bangles", ring: "Rings",
  pendant: "Pendants", necklace: "Necklaces", set: "Sets",
  earring: "Earrings", raw_material: "Raw Material",
};

export interface DropsProduct {
  id: string;
  name: string;
  category: string;
  slug: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  imageUrl: string | null;
  created_at: string;
}

export function NewDropsClient({
  products,
  subscribers,
  subscriberCount,
}: {
  products: DropsProduct[];
  subscribers: import("../SubscriberPicker").PickerSubscriber[];
  subscriberCount: number;
}) {
  const defaultSelected = new Set(products.slice(0, 4).map((p) => p.id));
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(defaultSelected);
  const [subject, setSubject] = useState(() => SUBJECT_OPTIONS[Math.floor(Math.random() * SUBJECT_OPTIONS.length)]);
  const [intro, setIntro] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function validate() {
    if (selectedProducts.size === 0) { setError("Select at least one product."); return false; }
    if (!subject.trim()) { setError("Subject is required."); return false; }
    if (targetMode === "selected" && selectedEmails.size === 0) { setError("Select at least one subscriber."); return false; }
    setError(null);
    return true;
  }

  function buildBody() {
    return {
      subject: subject.trim(),
      intro: intro.trim(),
      productIds: products.filter((p) => selectedProducts.has(p.id)).map((p) => p.id),
      targetEmails: targetMode === "selected" ? [...selectedEmails] : null,
    };
  }

  async function handlePreview() {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/emails/new-drops?preview=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
      else setError(data.error ?? "Preview failed.");
    } finally { setPreviewing(false); }
  }

  async function handleSend() {
    if (!validate()) return;
    const recipientLabel = targetMode === "all"
      ? `${subscriberCount} subscriber${subscriberCount !== 1 ? "s" : ""}`
      : `${selectedEmails.size} selected subscriber${selectedEmails.size !== 1 ? "s" : ""}`;
    if (!confirm(`Send "${subject}" to ${recipientLabel}?\n\n${selectedProducts.size} product${selectedProducts.size !== 1 ? "s" : ""} selected.`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/new-drops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error ?? "Send failed.");
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }

  const displayPrice = (p: DropsProduct) => p.sale_price_usd ?? p.price_display_usd;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Back */}
      <Link href="/custom-emails-admin" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Custom Emails
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">New Drops</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Feature available products in a showcase email. Only available pieces are shown.</p>

      <div className="space-y-6">
        {/* Email details */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Email Details</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <button
                  type="button"
                  onClick={() => {
                    const others = SUBJECT_OPTIONS.filter((s) => s !== subject);
                    setSubject(others[Math.floor(Math.random() * others.length)]);
                  }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Shuffle
                </button>
              </div>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Intro <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)}
                placeholder="Leave blank to use default: &quot;Discover our latest selection of natural jadeite pieces…&quot;"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
          </div>
        </section>

        {/* Product selection */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Products</h2>
            <span className="text-xs text-gray-400">{selectedProducts.size} selected</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => {
              const isSelected = selectedProducts.has(p.id);
              const price = displayPrice(p);
              return (
                <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                  className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${isSelected ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" sizes="160px" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>}
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? "bg-emerald-500 text-white" : "bg-white/80 border border-gray-300"}`}>
                      {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-0.5">{p.name}</p>
                    {price != null && <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">${price.toFixed(2)}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recipients */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Recipients</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} className="accent-emerald-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                All subscribers <span className="text-gray-400">({subscriberCount.toLocaleString()})</span>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "selected"} onChange={() => setTargetMode("selected")} className="accent-emerald-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Select specific subscribers</span>
            </label>
            {targetMode === "selected" && (
              <div className="mt-2">
                <SubscriberPicker subscribers={subscribers} selected={selectedEmails} onChange={setSelectedEmails} />
              </div>
            )}
          </div>
        </section>

        {/* Error / Result */}
        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.{result.failed > 0 ? ` ${result.failed} failed.` : ""}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing}
            className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors disabled:opacity-50">
            {previewing ? "Loading…" : "Preview Email"}
          </button>
          <button type="button" onClick={handleSend} disabled={sending || selectedProducts.size === 0}
            className="flex-1 rounded-full bg-emerald-700 hover:bg-emerald-800 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? "Sending…" : `Send${targetMode === "all" ? ` to ${subscriberCount.toLocaleString()} subscribers` : ` to ${selectedEmails.size} selected`}`}
          </button>
        </div>
      </div>

      {previewHtml && <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </div>
  );
}
