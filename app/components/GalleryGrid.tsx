"use client";

import { useEffect, useState } from "react";

const IMAGES = [
  "/gallery/IMG_4028.jpg",
  "/gallery/IMG_5466.jpg",
  "/gallery/IMG_5620.jpg",
  "/gallery/IMG_4157.jpg",
  "/gallery/IMG_5462.jpg",
  "/gallery/IMG_5623.jpg",
  "/gallery/IMG_5959.jpg",
  "/gallery/IMG_5463%202.jpg",
];

export function GalleryGrid() {
  const [active, setActive] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = active ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  return (
    <>
      {/* Masonry grid */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
        {IMAGES.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(src)}
            className="mb-3 break-inside-avoid overflow-hidden rounded-xl group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="BingBing Jade natural jadeite piece"
              className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt="BingBing Jade"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl select-none pointer-events-none"
              draggable={false}
            />

            {/* Watermark — centered logo over image */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/watermark3.svg"
                alt=""
                aria-hidden
                draggable={false}
                className="w-48 sm:w-64 opacity-60 select-none pointer-events-none"
              />
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Close"
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>

            {/* Prev / Next */}
            <button
              type="button"
              aria-label="Previous"
              onClick={() => {
                const i = IMAGES.indexOf(active);
                setActive(IMAGES[(i - 1 + IMAGES.length) % IMAGES.length]);
              }}
              className="absolute left-0 -translate-x-12 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => {
                const i = IMAGES.indexOf(active);
                setActive(IMAGES[(i + 1) % IMAGES.length]);
              }}
              className="absolute right-0 translate-x-12 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
