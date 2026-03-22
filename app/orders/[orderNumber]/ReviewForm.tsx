"use client";

import { useState } from "react";

type Props = {
  orderNumber: string;
  existingReview: { rating: number; description: string | null; date_rated: string } | null;
};

export default function ReviewForm({ orderNumber, existingReview }: Props) {
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [hovered, setHovered] = useState<number>(0);
  const [description, setDescription] = useState(existingReview?.description ?? "");
  const [submitted, setSubmitted] = useState(!!existingReview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const ratedOn = existingReview
    ? new Date(existingReview.date_rated).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
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
              <span
                key={i}
                className={`text-base ${i < rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
              >
                ★
              </span>
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
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-5 space-y-5"
        >
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
