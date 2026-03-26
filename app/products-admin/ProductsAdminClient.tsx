"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  bulkUpdateStatus,
  bulkUpdatePublished,
  bulkDelete,
} from "@/app/edit/bulk-actions";
import type { AdminProduct } from "./page";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["bracelet", "bangle", "ring", "pendant", "necklace", "other", "custom_order"] as const;

const STATUS_META: Record<string, { label: string; badge: string }> = {
  available: { label: "Available",  badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  on_sale:   { label: "On Sale",    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  sold:      { label: "Sold",       badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

const CAT_LABEL: Record<string, string> = {
  bracelet: "Bracelet",
  bangle:   "Bangle",
  ring:     "Ring",
  pendant:  "Pendant",
  necklace: "Necklace",
  other:        "Other",
  custom_order: "Custom Order",
};

// ── Main component ────────────────────────────────────────────────────────────

export function ProductsAdminClient({ products: initial }: { products: AdminProduct[] }) {
  const [products, setProducts] = useState<AdminProduct[]>(initial);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (catFilter && p.category !== catFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  // ── Toast helper ──────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const selectedIds = [...selected];

  function handleBulkStatus(status: "available" | "on_sale" | "sold") {
    if (!selectedIds.length) return;
    startTransition(async () => {
      const res = await bulkUpdateStatus(selectedIds, status);
      if (res.error) { showToast(`Error: ${res.error}`); return; }
      setProducts((prev) =>
        prev.map((p) => selectedIds.includes(p.id) ? { ...p, status } : p)
      );
      setSelected(new Set());
      showToast(`Updated ${res.count} product${res.count !== 1 ? "s" : ""}`);
    });
  }

  function handleBulkPublished(is_published: boolean) {
    if (!selectedIds.length) return;
    startTransition(async () => {
      const res = await bulkUpdatePublished(selectedIds, is_published);
      if (res.error) { showToast(`Error: ${res.error}`); return; }
      setProducts((prev) =>
        prev.map((p) => selectedIds.includes(p.id) ? { ...p, is_published } : p)
      );
      setSelected(new Set());
      showToast(`${is_published ? "Published" : "Drafted"} ${res.count} product${res.count !== 1 ? "s" : ""}`);
    });
  }

  function handleBulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} product${selectedIds.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await bulkDelete(selectedIds);
      if (res.error) { showToast(`Error: ${res.error}`); return; }
      setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelected(new Set());
      showToast(`Deleted ${res.count} product${res.count !== 1 ? "s" : ""}`);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{products.length} total</p>
          </div>
          <a
            href="/add"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Product
          </a>
        </div>

        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
        />

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  catFilter === cat
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {CAT_LABEL[cat]}
              </button>
            ))}
          </div>

          <div className="w-px bg-gray-200 dark:bg-gray-700 self-stretch mx-1" />

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_META).map(([val, meta]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(statusFilter === val ? null : val)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  statusFilter === val
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
              {selected.size} selected
            </span>

            {/* Status buttons */}
            <button
              type="button"
              onClick={() => handleBulkStatus("available")}
              disabled={isPending}
              className="rounded-full px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-colors"
            >
              Set Available
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus("on_sale")}
              disabled={isPending}
              className="rounded-full px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50 transition-colors"
            >
              Set On Sale
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus("sold")}
              disabled={isPending}
              className="rounded-full px-3 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50 transition-colors"
            >
              Set Sold
            </button>

            <div className="w-px bg-gray-200 dark:bg-gray-700 self-stretch" />

            {/* Published / Draft */}
            <button
              type="button"
              onClick={() => handleBulkPublished(true)}
              disabled={isPending}
              className="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() => handleBulkPublished(false)}
              disabled={isPending}
              className="rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Draft
            </button>

            <div className="flex-1" />

            {/* Delete */}
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              {query || catFilter || statusFilter ? "No products match your filters." : "No products yet."}
            </p>
          ) : (
            <>
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {filtered.map((p) => {
                  const statusMeta = STATUS_META[p.status];
                  const isChecked = selected.has(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600 shrink-0"
                      />

                      {/* Thumbnail */}
                      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        {p.thumbnailUrl ? (
                          <a href={p.slug} target="_blank">
                          <Image
                            src={p.thumbnailUrl}
                            alt={p.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                          </a>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{CAT_LABEL[p.category] ?? p.category}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.badge}`}>
                            {statusMeta.label}
                          </span>
                          {!p.is_published && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              Draft
                            </span>
                          )}
                          {p.price_display_usd != null && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ${p.price_display_usd.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit button */}
                      <a
                        href={`/edit/${p.id}`}
                        className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      >
                        Edit
                      </a>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
