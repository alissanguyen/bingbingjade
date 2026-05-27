"use client";

import { useState, useEffect, useRef } from "react";

const AUTO_ADVANCE_MS = 5000;

export type CarouselReview = {
  id: string;
  orderNumber: string;
  datePurchased: string;
  name: string;
  review: string;
  image_url?: string;
};

function ArrowBtn({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="hidden r2:flex w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 items-center justify-center text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-sm shrink-0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

const PREVIEW_LENGTH = 180;

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, s) => (
        <svg key={s} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewModal({ review, onClose }: { review: CarouselReview; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block mb-2">&ldquo;</span>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto pr-1">
          {review.review}
        </p>
        <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block text-right mt-2">&rdquo;</span>

        {review.image_url && (
          <div className="mt-3">
            <a href={review.image_url} target="_blank" rel="noopener noreferrer"
              className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={review.image_url} alt="" className="w-full h-full object-cover" />
            </a>
          </div>
        )}

        <StarRating />
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{review.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{review.datePurchased}</p>
          </div>
          <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{review.orderNumber}</span>
        </div>
      </div>
    </div>
  );
}

export function ReviewsCarousel({ dbReviews }: { dbReviews?: CarouselReview[] }) {
  const reviews = dbReviews ?? [];
  const [modalReview, setModalReview] = useState<CarouselReview | null>(null);
  const [page, setPage] = useState(0);
  const [mobileSubIndex, setMobileSubIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [colCount, setColCount] = useState(4);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640)       setColCount(1);
      else if (w < 900)  setColCount(2);
      else if (w < 1280) setColCount(3);
      else               setColCount(4);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setPage(0);
    setMobileSubIndex(0);
  }, [colCount]);

  const totalPages = Math.ceil(reviews.length / colCount);
  const pageReviews = reviews.slice(page * colCount, (page + 1) * colCount);
  const globalIndex = page * colCount + mobileSubIndex;

  useEffect(() => {
    if (paused || modalReview || reviews.length === 0) return;
    timerRef.current = setInterval(() => {
      const nextGlobal = (globalIndex + 1) % reviews.length;
      setPage(Math.floor(nextGlobal / colCount));
      setMobileSubIndex(nextGlobal % colCount);
    }, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, modalReview, globalIndex, reviews.length, colCount]);

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function goTo(next: number) {
    resetTimer();
    setPage((next + totalPages) % totalPages);
    setMobileSubIndex(0);
  }

  function goMobile(dir: 1 | -1) {
    resetTimer();
    const nextGlobal = (globalIndex + dir + reviews.length) % reviews.length;
    setPage(Math.floor(nextGlobal / colCount));
    setMobileSubIndex(nextGlobal % colCount);
  }

  if (reviews.length === 0) return null;

  return (
    <div
      className="py-16 bg-white dark:bg-gray-950"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 mb-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Happy Customers
            </p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">What People Are Saying</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex r2:hidden items-center gap-2">
              <button onClick={() => goMobile(-1)} aria-label="Previous" className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 text-center">{globalIndex + 1} / {reviews.length}</span>
              <button onClick={() => goMobile(1)} aria-label="Next" className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <ArrowBtn dir="left" onClick={() => goTo(page - 1)} />
            <div className="hidden r2:flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Page ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === page
                      ? "w-4 h-2 bg-emerald-500 dark:bg-emerald-400"
                      : "w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>
            <ArrowBtn dir="right" onClick={() => goTo(page + 1)} />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="mx-auto max-w-7xl px-6">
        {/* Mobile: single card */}
        <div className="r2:hidden">
          {(() => {
            const r = pageReviews[mobileSubIndex] ?? pageReviews[0];
            if (!r) return null;
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;
            return (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col">
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-2">&ldquo;</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{preview}</p>
                {isLong && (
                  <button onClick={() => setModalReview(r)} className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start">See more</button>
                )}
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-2">&rdquo;</span>
                {r.image_url && (
                  <div className="mt-3 mb-1">
                    <a href={r.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="block w-14 h-14 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                    </a>
                  </div>
                )}
                <StarRating />
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{r.orderNumber}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Desktop: grid */}
        <div
          className="hidden r2:grid gap-5"
          style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
        >
          {pageReviews.map((r) => {
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col">
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-2">&ldquo;</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{preview}</p>
                {isLong && (
                  <button onClick={() => setModalReview(r)} className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start">
                    See more
                  </button>
                )}
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-2">&rdquo;</span>
                {r.image_url && (
                  <div className="mt-3 mb-1">
                    <a href={r.image_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="block w-14 h-14 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-90 transition-opacity shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                    </a>
                  </div>
                )}
                <StarRating />
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{r.orderNumber}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalReview && <ReviewModal review={modalReview} onClose={() => setModalReview(null)} />}
    </div>
  );
}
