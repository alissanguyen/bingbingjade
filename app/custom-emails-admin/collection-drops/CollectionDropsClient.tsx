"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { SubscriberPicker } from "../SubscriberPicker";

export type { PickerSubscriber } from "../SubscriberPicker";

export interface CollectionScene {
  id: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface CollectionOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  scenes: CollectionScene[];
  products: CollectionProduct[];
}

export interface CollectionProduct {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelet", bangle: "Bangle", ring: "Ring", pendant: "Pendant",
  necklace: "Necklace", set: "Set", earring: "Earrings", raw_material: "Raw Material",
};

export function CollectionDropsClient({
  collections,
  subscribers,
  subscriberCount,
}: {
  collections: CollectionOption[];
  subscribers: import("../SubscriberPicker").PickerSubscriber[];
  subscriberCount: number;
}) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(collections[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collection = collections.find((c) => c.id === selectedCollectionId) ?? null;

  function handleCollectionChange(id: string) {
    const col = collections.find((c) => c.id === id);
    if (!col) return;
    setSelectedCollectionId(id);
    setSubject(`Introducing ${col.name} — BingBing Jade`);
    setIntro(col.description ?? "");
    setSelectedProductIds(new Set(col.products.map((p) => p.id)));
    setError(null);
    setResult(null);
  }

  // Initialize with the first collection on mount
  useState(() => {
    if (collections[0]) handleCollectionChange(collections[0].id);
  });

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function validate() {
    if (!selectedCollectionId) { setError("Select a collection."); return false; }
    if (!subject.trim()) { setError("Subject is required."); return false; }
    if (targetMode === "selected" && selectedEmails.size === 0) { setError("Select at least one subscriber."); return false; }
    setError(null);
    return true;
  }

  function buildBody() {
    return {
      collectionId: selectedCollectionId,
      subject: subject.trim(),
      intro: intro.trim(),
      productIds: selectedProductIds.size > 0 ? [...selectedProductIds] : undefined,
      targetEmails: targetMode === "selected" ? [...selectedEmails] : null,
    };
  }

  async function handlePreview() {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/emails/collection-drops?preview=1", {
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
    if (!confirm(`Send "${subject}" to ${recipientLabel}?\n\nCollection: ${collection?.name}`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/collection-drops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error ?? "Send failed.");
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Back */}
      <Link href="/custom-emails-admin" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Custom Emails
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Collection Drops</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Announce a BingBing exclusive collection to your subscribers. Features the collection's scene imagery and selected pieces.</p>

      <div className="space-y-6">

        {/* Collection picker */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Collection</h2>

          {collections.length === 0 ? (
            <p className="text-sm text-gray-400">No published collections found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {collections.map((col) => {
                const isSelected = col.id === selectedCollectionId;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleCollectionChange(col.id)}
                    className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${isSelected ? "border-teal-500 ring-1 ring-teal-500/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                  >
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                      {col.sceneImageUrl
                        ? <Image src={col.sceneImageUrl} alt={col.name} fill unoptimized className="object-cover" sizes="200px" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>}
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? "bg-teal-500 text-white" : "bg-white/80 border border-gray-300"}`}>
                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{col.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{col.products.length} piece{col.products.length !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Email details */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Email Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Introducing Summer Jade — BingBing Jade"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Intro <span className="text-gray-400 font-normal">(optional — leave blank to use default)</span>
              </label>
              <textarea
                rows={2}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="A short description of this collection to appear in the email hero…"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>
        </section>

        {/* Products from collection */}
        {collection && collection.products.length > 0 && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Featured Pieces</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{selectedProductIds.size} selected</span>
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(new Set(collection.products.map((p) => p.id)))}
                  className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Select all
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {collection.products.map((p) => {
                const isSelected = selectedProductIds.has(p.id);
                const price = p.sale_price_usd ?? p.price_display_usd;
                return (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                    className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${isSelected ? "border-teal-500 ring-1 ring-teal-500/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                      {p.imageUrl
                        ? <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" sizes="160px" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>}
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? "bg-teal-500 text-white" : "bg-white/80 border border-gray-300"}`}>
                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-0.5">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-0.5">{p.name}</p>
                      {price != null && <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">${price.toFixed(2)}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Recipients */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Recipients</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} className="accent-teal-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                All subscribers <span className="text-gray-400">({subscriberCount.toLocaleString()})</span>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "selected"} onChange={() => setTargetMode("selected")} className="accent-teal-600" />
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
          <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3 text-sm text-teal-700 dark:text-teal-400">
            ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.{result.failed > 0 ? ` ${result.failed} failed.` : ""}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing || !selectedCollectionId}
            className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors disabled:opacity-50">
            {previewing ? "Loading…" : "Preview Email"}
          </button>
          <button type="button" onClick={handleSend} disabled={sending || !selectedCollectionId}
            className="flex-1 rounded-full bg-teal-700 hover:bg-teal-800 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? "Sending…" : `Send${targetMode === "all" ? ` to ${subscriberCount.toLocaleString()} subscribers` : ` to ${selectedEmails.size} selected`}`}
          </button>
        </div>
      </div>

      {previewHtml && <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </div>
  );
}
