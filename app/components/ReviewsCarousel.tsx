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

function toInitials(name: string): string {
  return name.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + ".").join("");
}

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
        className="w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-end px-4 pt-4 pb-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shadow-sm"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {review.image_url && (
          <a href={review.image_url} target="_blank" rel="noopener noreferrer"
            className="block mx-5 mb-5 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-95 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={review.image_url} alt="" className="w-full aspect-[4/3] sm:aspect-square object-cover" />
          </a>
        )}

        <div className="px-6 pt-1 pb-6">
          <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block mb-1">&ldquo;</span>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
            {review.review}
          </p>
          <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none block text-right mt-1">&rdquo;</span>

          <StarRating />
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toInitials(review.name)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{review.datePurchased}</p>
            </div>
            <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">{review.orderNumber}</span>
          </div>
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
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const mobileScrollDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const totalPages = Math.ceil(reviews.length / colCount);
  // Clamp in render so a colCount change never leaves page/mobileSubIndex out of bounds
  const safePage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
  const pageReviews = reviews.slice(safePage * colCount, (safePage + 1) * colCount);
  const safeMobileSubIndex = pageReviews.length > 0 ? Math.min(mobileSubIndex, pageReviews.length - 1) : 0;
  const globalIndex = safePage * colCount + safeMobileSubIndex;

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

  // Programmatically scroll mobile track when auto-advance fires
  useEffect(() => {
    const track = mobileScrollRef.current;
    if (!track || colCount !== 1) return;
    isProgrammaticScroll.current = true;
    track.scrollTo({ left: globalIndex * track.offsetWidth, behavior: "smooth" });
    const t = setTimeout(() => { isProgrammaticScroll.current = false; }, 800);
    return () => clearTimeout(t);
  }, [globalIndex, colCount]);

  function handleMobileScroll() {
    if (mobileScrollDebounce.current) clearTimeout(mobileScrollDebounce.current);
    mobileScrollDebounce.current = setTimeout(() => {
      const track = mobileScrollRef.current;
      if (!track || isProgrammaticScroll.current) return;
      const newIndex = Math.round(track.scrollLeft / track.offsetWidth);
      if (newIndex !== globalIndex && newIndex >= 0 && newIndex < reviews.length) {
        resetTimer();
        setPage(newIndex);
        setMobileSubIndex(0);
      }
      isProgrammaticScroll.current = false;
    }, 100);
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
            <ArrowBtn dir="left" onClick={() => goTo(page - 1)} />
            <div className="hidden r2:flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Page ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === safePage
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
      <div className="mx-auto max-w-7xl">
        {/* Mobile: native horizontal scroll snap */}
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="r2:hidden flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: "none" }}
        >
          {reviews.map((r) => {
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;
            return (
              <div key={r.id} className="min-w-full shrink-0 snap-center px-6">
                <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col">
                    <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-1">&ldquo;</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{preview}</p>
                    {isLong && (
                      <button onClick={() => setModalReview(r)} className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start">See more</button>
                    )}
                    <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-1">&rdquo;</span>
                    <StarRating />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.image_url && (
                          <button onClick={() => setModalReview(r)} className="w-10 h-10 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-80 transition-opacity shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                          </button>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toInitials(r.name)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-300 dark:text-gray-600 font-mono shrink-0">{r.orderNumber}</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Desktop: grid */}
        <div
          className="hidden r2:grid gap-5 px-6"
          style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
        >
          {pageReviews.map((r) => {
            const isLong = r.review.length > PREVIEW_LENGTH;
            const preview = isLong ? r.review.slice(0, PREVIEW_LENGTH).trimEnd() + "…" : r.review;
            return (
              <div key={r.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col">
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none mb-1">&ldquo;</span>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{preview}</p>
                {isLong && (
                  <button onClick={() => setModalReview(r)} className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline self-start">
                    See more
                  </button>
                )}
                <span className="text-5xl leading-none text-emerald-200 dark:text-emerald-900 font-serif select-none self-end mt-1">&rdquo;</span>
                <StarRating />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.image_url && (
                      <button onClick={() => setModalReview(r)} className="w-10 h-10 rounded-md overflow-hidden border border-gray-100 dark:border-gray-800 hover:opacity-80 transition-opacity shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toInitials(r.name)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{r.datePurchased}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-gray-600 font-mono shrink-0">{r.orderNumber}</span>
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
