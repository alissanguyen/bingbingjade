"use client";

import { useRef, useState } from "react";

type Props = {
  orderNumber: string;
  existingReview: { rating: number; description: string | null; date_rated: string } | null;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only jpg, png, webp allowed.`;
  if (file.size > MAX_FILE_SIZE) return `${file.name}: exceeds 5 MB limit.`;
  return null;
}

export default function ReviewForm({ orderNumber, existingReview }: Props) {
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [hovered, setHovered] = useState<number>(0);
  const [description, setDescription] = useState(existingReview?.description ?? "");
  const [submitted, setSubmitted] = useState(!!existingReview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageWarning, setImageWarning] = useState<string | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addImages(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);

    if (images.length + incoming.length > MAX_IMAGES) {
      setImageWarning(`You can attach up to ${MAX_IMAGES} photos.`);
      return;
    }

    for (const f of incoming) {
      const err = validateImage(f);
      if (err) { setImageWarning(err); return; }
    }

    setImageWarning(null);
    const newPreviews = incoming.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...incoming]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setImageWarning(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addImages(e.dataTransfer.files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating."); return; }
    setLoading(true);
    setError(null);
    setImageWarning(null);

    let reviewId: string | null = null;

    // Step 1: submit rating + description
    try {
      const res = await fetch(`/api/orders/${orderNumber}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, description: description.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      reviewId = data.review?.id ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
      return;
    }

    // Step 2: upload images (best-effort — failure shows warning, not blocking error)
    if (images.length > 0 && reviewId) {
      const fd = new FormData();
      images.forEach((f) => fd.append("image", f));
      try {
        const res = await fetch(`/api/reviews/${reviewId}/images`, { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImageWarning(`Review submitted, but image upload failed: ${data.error ?? "Unknown error."}`);
        }
      } catch {
        setImageWarning("Review submitted, but we couldn't upload your photos. Please contact us if you'd like them added.");
      }
    }

    setSubmitted(true);
    setLoading(false);
  }

  const ratedOn = existingReview
    ? new Date(existingReview.date_rated).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-4">
        Share Your Experience
      </h2>

      {submitted ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-5">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
            Thank you for your review!
          </p>
          <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={`text-base ${i < rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}>★</span>
            ))}
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{rating}/10</span>
          </div>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">
              &ldquo;{description}&rdquo;
            </p>
          )}
          {ratedOn && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Reviewed on {ratedOn}</p>
          )}
          {imageWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{imageWarning}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Your review will appear publicly after admin approval.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-5 space-y-5"
        >
          {/* Rating */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Rating <span className="text-gray-400">(out of 10)</span>
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const val = i + 1;
                const filled = val <= (hovered || rating);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRating(val)}
                    onMouseEnter={() => setHovered(val)}
                    onMouseLeave={() => setHovered(0)}
                    className={`text-2xl leading-none transition-colors ${
                      filled ? "text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-amber-300"
                    }`}
                    aria-label={`${val} out of 10`}
                  >
                    ★
                  </button>
                );
              })}
              {rating > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{rating}/10</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">
              Your review <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell us about your experience with your jade piece..."
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Photos <span className="font-normal text-gray-400">(optional · up to {MAX_IMAGES})</span>
            </p>

            {/* Drop zone — shown when under limit */}
            {images.length < MAX_IMAGES && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-xs text-gray-400 dark:text-gray-500">Click or drag to upload</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600">jpg · png · webp · max 5 MB each</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => addImages(e.target.files)}
            />

            {/* Previews */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center leading-none hover:bg-black/80 transition-colors"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {imageWarning && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{imageWarning}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {loading ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      )}
    </div>
  );
}
