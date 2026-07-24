"use client";

import { useState } from "react";
import Image from "next/image";

interface OriginalImage {
  id: string;
  storage_path: string;
  signed_url: string | null;
  uploaded_at: string;
}

interface LookupResult {
  sku: string;
  images: OriginalImage[];
  vendor: {
    id: string | null;
    name: string | null;
    platform: string | null;
    contact: string | null;
  } | null;
  product: {
    id: string;
    name: string;
    public_id: string;
    category: string;
    created_at: string;
    renewed_at: string | null;
    sourcing_notes: string | null;
    size: string | null;
    is_oval: boolean;
    wrist_size: string | null;
    size_detailed: (number | null)[] | null;
  } | null;
}

function formatSize(product: NonNullable<LookupResult["product"]>): string | null {
  if (product.is_oval) {
    const sd = product.size_detailed;
    const dims = sd && sd.length >= 4 ? `${sd[0]} × ${sd[1]} × ${sd[2]} × ${sd[3]} mm` : null;
    const parts = [dims, product.wrist_size ? `fits wrist: ${product.wrist_size}` : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : product.size || null;
  }
  const sd = product.size_detailed;
  if (sd && sd.length >= 3 && sd.some((v) => v != null)) {
    return `${sd[0]} × ${sd[1]} × ${sd[2]} mm`;
  }
  return product.size || null;
}

export function ItemOriginLookupClient() {
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!sku.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const res = await fetch(
      `/api/admin/item-origin-lookup?sku=${encodeURIComponent(sku.trim())}`
    );
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "Not found");
    } else {
      setResult(json);
      setSelectedIds(new Set());
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!result) return;
    const allIds = result.images.map((i) => i.id);
    setSelectedIds((prev) => prev.size === allIds.length ? new Set() : new Set(allIds));
  }

  async function handleDelete(img: OriginalImage) {
    if (!confirm("Delete this image? This cannot be undone.")) return;
    setDeletingId(img.id);
    const res = await fetch(`/api/admin/item-origin-lookup?id=${img.id}`, { method: "DELETE" });
    if (res.ok) {
      setResult((prev) => prev ? { ...prev, images: prev.images.filter((i) => i.id !== img.id) } : prev);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(img.id); return next; });
    }
    setDeletingId(null);
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} image${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = [...selectedIds].join(",");
    const res = await fetch(`/api/admin/item-origin-lookup?ids=${encodeURIComponent(ids)}`, { method: "DELETE" });
    if (res.ok) {
      setResult((prev) => prev ? { ...prev, images: prev.images.filter((i) => !selectedIds.has(i.id)) } : prev);
      setSelectedIds(new Set());
    }
    setBulkDeleting(false);
  }

  const vendor = result?.vendor;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Item Origin Lookup
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Enter a listing SKU to retrieve the original vendor images and sourcing info.
        </p>

        {/* Search */}
        <form onSubmit={handleLookup} className="flex gap-3 mb-8">
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="8-digit SKU, e.g. 00012345"
            maxLength={10}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={loading || !sku.trim()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 transition-colors"
          >
            {loading ? "Searching…" : "Look up"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6">
            {error === "Not found"
              ? `No original images found for SKU "${sku.trim()}".`
              : error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Info card */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-5">

              {/* SKU + edit link */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">SKU</p>
                  <p className="text-3xl font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">
                    {result.sku}
                  </p>
                </div>
                {result.product && (
                  <a
                    href={`/edit/${result.product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 shrink-0"
                  >
                    Edit listing →
                  </a>
                )}
              </div>

              {result.product ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                  {/* Listing */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Listing</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {result.product.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{result.product.public_id}</p>
                  </div>

                  {/* Size */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Size</p>
                    {formatSize(result.product) ? (
                      <p className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                        {formatSize(result.product)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Not set</p>
                    )}
                  </div>

                  {/* Vendor */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Vendor</p>
                    {vendor ? (
                      <>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{vendor.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                          {vendor.platform}{vendor.contact ? ` · ${vendor.contact}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No vendor linked</p>
                    )}
                  </div>

                  {/* Date posted */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Originally Posted</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(result.product.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(result.product.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    {result.product.renewed_at && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-0.5">Renewed</p>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {new Date(result.product.renewed_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(result.product.renewed_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic border-t border-gray-100 dark:border-gray-800 pt-4">
                  No product linked to this SKU yet.
                </p>
              )}

              {result.product?.sourcing_notes && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Source / Vendor Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {result.product.sourcing_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Original images grid */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Original Images ({result.images.length})
                </p>
                {result.images.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {selectedIds.size === result.images.length ? "Deselect all" : "Select all"}
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                      >
                        {bulkDeleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.images.map((img, i) => {
                  const isSelected = selectedIds.has(img.id);
                  return (
                    <div
                      key={img.id}
                      className={`rounded-xl border bg-white dark:bg-gray-900 overflow-hidden transition-colors ${isSelected ? "border-red-400 dark:border-red-600 ring-2 ring-red-400/40" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      <div className="relative">
                        {img.signed_url ? (
                          <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                            <Image
                              src={img.signed_url}
                              alt={`Original image ${i + 1}`}
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs">
                            Unavailable
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(img.id)}
                          className="absolute top-2 left-2 w-4 h-4 accent-red-500 cursor-pointer"
                          aria-label={`Select image ${i + 1}`}
                        />
                      </div>
                      <div className="p-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-400">
                          {new Date(img.uploaded_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {img.signed_url && (
                            <a
                              href={img.signed_url}
                              download
                              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              Download
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(img)}
                            disabled={deletingId === img.id || bulkDeleting}
                            className="text-[11px] font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            {deletingId === img.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
