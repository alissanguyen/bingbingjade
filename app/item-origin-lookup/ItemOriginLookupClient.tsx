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
  } | null;
}

export function ItemOriginLookupClient() {
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    }
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
                <div className="grid sm:grid-cols-3 gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                  {/* Listing */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Listing</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {result.product.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{result.product.public_id}</p>
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
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic border-t border-gray-100 dark:border-gray-800 pt-4">
                  No product linked to this SKU yet.
                </p>
              )}
            </div>

            {/* Original images grid */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Original Images ({result.images.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.images.map((img, i) => (
                  <div
                    key={img.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
                  >
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
                    <div className="p-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400">
                        {new Date(img.uploaded_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {img.signed_url && (
                        <a
                          href={img.signed_url}
                          download
                          className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
