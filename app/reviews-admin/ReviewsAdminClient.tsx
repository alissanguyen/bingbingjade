"use client";

import { useRef, useState } from "react";
import type { AdminReview } from "./page";
import { ImageCropModal } from "@/app/add/MediaCroppers";

const TAB_VALUES = ["all", "pending", "approved"] as const;
type Tab = (typeof TAB_VALUES)[number];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < rating ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`}>★</span>
      ))}
      <span className="ml-1.5 text-xs text-gray-400">{rating}/10</span>
    </div>
  );
}

function ImageZone({
  reviewId,
  imageUrl,
  onImageChange,
  onToast,
}: {
  reviewId: string;
  imageUrl: string | null;
  onImageChange: (path: string | null, url: string | null) => void;
  onToast: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("");

  // pending (cropped, not yet saved) state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openPicker() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropFileName(file.name);
    setCropSrc(url);
  }

  function handleCropConfirm(croppedFile: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(croppedFile);
    setPendingPreview(URL.createObjectURL(croppedFile));
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function discardPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
  }

  async function handleSave() {
    if (!pendingFile) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("image", pendingFile);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/images`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast(data.error ?? "Upload failed.");
      } else {
        onImageChange(data.image_path, data.image_url);
        discardPending();
        onToast("Photo saved.");
      }
    } catch {
      onToast("Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this photo?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/images`, { method: "DELETE" });
      if (res.ok) {
        onImageChange(null, null);
        onToast("Photo removed.");
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error ?? "Failed to remove photo.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Saved image */}
      {imageUrl && !pendingPreview && (
        <div className="flex items-center gap-3">
          <div className="relative w-20 h-20 shrink-0 group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Review" className="w-full h-full object-cover" />
            </a>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs flex items-center justify-center leading-none opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title="Remove photo"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            Replace photo
          </button>
        </div>
      )}

      {/* Pending (cropped, unsaved) preview */}
      {pendingPreview && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 flex items-center gap-4">
          <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingPreview} alt="Cropped preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Ready to save — crop applied</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save photo"}
              </button>
              <button
                type="button"
                onClick={openPicker}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Re-crop
              </button>
              <button
                type="button"
                onClick={discardPending}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add photo button (shown when no saved image and no pending) */}
      {!imageUrl && !pendingPreview && (
        <button
          type="button"
          onClick={openPicker}
          className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          Add photo
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Crop modal */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          fileName={cropFileName}
          onConfirm={handleCropConfirm}
          onClose={handleCropCancel}
        />
      )}
    </div>
  );
}

export function ReviewsAdminClient({ reviews: initial }: { reviews: AdminReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleApprove(id: string, approve: boolean) {
    setApproving(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_approved: approve }),
      });
      if (res.ok) {
        setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: approve } : r));
        showToast(approve ? "Review approved and published." : "Review unpublished.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Action failed.");
      }
    } finally {
      setApproving(null);
    }
  }

  async function handleDelete(id: string, customerName: string) {
    if (!confirm(`Delete review from ${customerName}?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        showToast("Review deleted.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Delete failed.");
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleImageChange(reviewId: string, path: string | null, url: string | null) {
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, image_path: path, image_url: url } : r));
  }

  const filtered = reviews.filter((r) => {
    if (tab === "pending") return !r.is_approved;
    if (tab === "approved") return r.is_approved;
    return true;
  });

  const pendingCount = reviews.filter((r) => !r.is_approved).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Reviews</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {reviews.length} total · {pendingCount} pending approval
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {TAB_VALUES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === t
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}{t === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No reviews in this view.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-5 space-y-3 ${
                r.is_approved
                  ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                  : "border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20"
              }`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.customer_name}</span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{r.order_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                      r.is_approved
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                    }`}>
                      {r.is_approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <StarRow rating={r.rating} />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Submitted {fmt(r.date_rated)} · Purchased {fmt(r.date_purchased)}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {!r.is_approved ? (
                    <button
                      type="button"
                      disabled={approving === r.id}
                      onClick={() => handleApprove(r.id, true)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                    >
                      {approving === r.id ? "Approving…" : "Approve"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={approving === r.id}
                      onClick={() => handleApprove(r.id, false)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {approving === r.id ? "Updating…" : "Unpublish"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={deleting === r.id}
                    onClick={() => handleDelete(r.id, r.customer_name)}
                    className="text-xs text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {deleting === r.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {r.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-l-2 border-gray-200 dark:border-gray-700 pl-3 italic">
                  &ldquo;{r.description}&rdquo;
                </p>
              )}

              <ImageZone
                reviewId={r.id}
                imageUrl={r.image_url}
                onImageChange={(path, url) => handleImageChange(r.id, path, url)}
                onToast={showToast}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
