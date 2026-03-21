"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { bulkUpdateStatus, bulkDelete } from "./bulk-actions";

interface ProductStub {
  id: string;
  name: string;
  category: string;
  status: "available" | "on_sale" | "sold";
  images: string[];
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  on_sale:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  sold:      "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  on_sale:   "On Sale",
  sold:      "Sold",
};

const CATEGORIES = ["bracelet", "bangle", "ring", "pendant", "necklace", "other"] as const;

export function ProductSearch({ products }: { products: ProductStub[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<"available" | "on_sale" | "sold">("available");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) &&
    (categoryFilter === null || p.category === categoryFilter)
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmDelete(false);
    setError(null);
  };

  const handleBulkStatus = () => {
    setError(null);
    startTransition(async () => {
      const result = await bulkUpdateStatus(Array.from(selected), bulkStatus);
      if (result.error) {
        setError(result.error);
      } else {
        exitSelectMode();
        router.refresh();
      }
    });
  };

  const handleBulkDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await bulkDelete(Array.from(selected));
      if (result.error) {
        setError(result.error);
      } else {
        exitSelectMode();
        router.refresh();
      }
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <div>
      {/* Search + Select toggle */}
      <div className="flex gap-3 items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
        />
        {!selectMode ? (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            Select
          </button>
        ) : (
          <button
            type="button"
            onClick={exitSelectMode}
            className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3.5 py-1.5 text-sm border transition-all ${categoryFilter === null ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
            className={`rounded-full px-3.5 py-1.5 text-sm border transition-all capitalize ${categoryFilter === c ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Select-mode controls */}
      {selectMode && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${allFilteredSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600"}`}>
              {allFilteredSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {allFilteredSelected ? "Deselect all" : "Select all"}
          </button>
          {selected.size > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{selected.size} selected</span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-gray-400 dark:text-gray-600">No products match your search.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const isSelected = selected.has(product.id);
            if (!selectMode) {
              return (
                <Link
                  key={product.id}
                  href={`/edit/${product.id}`}
                  className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all"
                >
                  <div className="aspect-square w-full bg-emerald-50 dark:bg-emerald-950 overflow-hidden relative">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name} fill unoptimized className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="200px" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🪨</div>
                    )}
                    <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[product.status]}`}>
                      {STATUS_LABELS[product.status]}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{product.category}</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{product.name}</p>
                  </div>
                </Link>
              );
            }

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggleSelect(product.id)}
                className={`group relative rounded-xl border-2 bg-white dark:bg-gray-900 overflow-hidden transition-all text-left ${
                  isSelected
                    ? "border-emerald-500 shadow-md"
                    : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
              >
                <div className="aspect-square w-full bg-emerald-50 dark:bg-emerald-950 overflow-hidden relative">
                  {product.images?.[0] ? (
                    <Image src={product.images[0]} alt={product.name} fill unoptimized className="object-cover" sizes="200px" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🪨</div>
                  )}
                  <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[product.status]}`}>
                    {STATUS_LABELS[product.status]}
                  </span>
                  {/* Checkbox overlay */}
                  <span className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-white/80 bg-black/20"}`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{product.category}</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{product.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-xl">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4">
            {error && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {!confirmDelete ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selected.size} product{selected.size !== 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-2 items-center">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="available">Available</option>
                    <option value="on_sale">On Sale</option>
                    <option value="sold">Sold</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkStatus}
                    disabled={isPending}
                    className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending ? "Saving…" : "Set Status"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-red-200 dark:border-red-900 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete {selected.size} product{selected.size !== 1 ? "s" : ""}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Delete {selected.size} product{selected.size !== 1 ? "s" : ""}? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending ? "Deleting…" : "Yes, Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
