"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const IMAGES = [
  "/gallery/IMG_4028.jpg",
  "/gallery/IMG_5466.jpg",
  "/gallery/IMG_5620.jpg",
  "/gallery/IMG_4157.jpg",
  "/gallery/IMG_5462.jpg",
  "/gallery/IMG_5623.jpg",
  "/gallery/IMG_5959.jpg",
  "/gallery/IMG_5463%202.jpg",
  "/gallery/IMG_3968.jpg",
  "/gallery/IMG_3511.jpg",
  "/gallery/IMG_5395.jpg",
  "/gallery/IMG_6272.jpg",
  "/gallery/IMG_6273.jpg",
  "/gallery/IMG_6278.jpg",
  "/gallery/IMG_6279.jpg",
  "/gallery/IMG_6280.jpg",
  "/gallery/IMG_6282.jpg",
  "/gallery/IMG_6283.jpg",
  "/gallery/IMG_6286.jpg",
  "/gallery/IMG_6287.jpg",
  "/gallery/IMG_6288.jpg",
  "/gallery/IMG_6290.jpg",
  "/gallery/IMG_6294.jpg",
  "/gallery/IMG_6295.jpg",
  "/gallery/IMG_6297.jpg",
  "/gallery/IMG_6298.jpg",
];

const INITIAL_COUNT = 8;

export function GalleryGrid() {
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasMore = IMAGES.length > INITIAL_COUNT;

  // Close on Escape
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

  // Prevent body scroll when lightbox open
  useEffect(() => {
    document.body.style.overflow = active ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  return (
    <>
      {/* Masonry grid with fade-out when collapsed */}
      <div className="relative">
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
          {(expanded ? IMAGES : IMAGES.slice(0, INITIAL_COUNT)).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(src)}
              className="mb-3 break-inside-avoid overflow-hidden rounded-xl group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Image
                src={src}
                alt="BingBing Jade natural jadeite piece"
                width={600}
                height={600}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading="lazy"
              />
            </button>
          ))}
        </div>

        {/* Gradient fade + toggle button */}
        {hasMore && (
          <div
            className={`absolute bottom-0 left-0 right-0 h-44 bg-linear-to-b from-transparent via-white/80 to-white dark:via-gray-950/80 dark:to-gray-950 transition-opacity duration-500 ${expanded ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          />
        )}
      </div>

      {hasMore && (
        <div className="text-center mt-4 mb-6">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {expanded ? "Show less" : "Show more photos"}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

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
            <Image
              src={active}
              alt="BingBing Jade"
              width={1200}
              height={1200}
              className="max-w-full max-h-[85vh] w-auto h-auto rounded-2xl object-contain shadow-2xl select-none pointer-events-none"
              sizes="90vw"
              loading="eager"
              draggable={false}
            />

            {/* Watermark */}
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

            {/* Close */}
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Close"
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>

            {/* Prev */}
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

            {/* Next */}
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
