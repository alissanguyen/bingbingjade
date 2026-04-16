"use client";

import { useEffect, useRef, useState } from "react";

// ── Image data ────────────────────────────────────────────────────────────────
// Add new entries here as the gallery grows; alt text is used by screen readers
// and image search engines.
interface GalleryImage {
  id: string;
  src: string;
  alt: string;
}

const IMAGES: GalleryImage[] = [
  { id: "1",  src: "/gallery/IMG_4028.jpg",      alt: "Natural jadeite bangle — rich green translucency" },
  { id: "2",  src: "/gallery/IMG_5466.jpg",      alt: "Lavender jadeite bangle in natural light" },
  { id: "3",  src: "/gallery/IMG_5620.jpg",      alt: "Icy jadeite bracelet with glassy clarity" },
  { id: "4",  src: "/gallery/IMG_4157.jpg",      alt: "Fine jadeite pendant — close-up detail" },
  { id: "5",  src: "/gallery/IMG_5462.jpg",      alt: "Type A jadeite bangle — imperial green" },
  { id: "6",  src: "/gallery/IMG_5623.jpg",      alt: "Jadeite ring in soft diffused light" },
  { id: "7",  src: "/gallery/IMG_5959.jpg",      alt: "Collection flat-lay — assorted jade pieces" },
  { id: "8",  src: "/gallery/IMG_5463%202.jpg",  alt: "Jadeite bangle detail — natural inclusions" },
  { id: "9",  src: "/gallery/IMG_3968.jpg",      alt: "Burmese jadeite bangle — vivid color" },
  { id: "10", src: "/gallery/IMG_6272.jpg",      alt: "Studio shot — jadeite bracelet in hand" },
  { id: "11", src: "/gallery/IMG_6273.jpg",      alt: "Natural jadeite piece — texture close-up" },
  { id: "12", src: "/gallery/IMG_6274.jpg",      alt: "Jadeite jewelry on neutral surface" },
  { id: "13", src: "/gallery/IMG_6288.jpg",      alt: "Translucent jadeite bangle — light through stone" },
  { id: "14", src: "/gallery/IMG_6294.jpg",      alt: "Fine jadeite — color saturation detail" },
  { id: "15", src: "/gallery/IMG_6296.jpg",      alt: "Jadeite bangle — indoor natural lighting" },
  { id: "16", src: "/gallery/IMG_6298.jpg",      alt: "Type A jadeite — surface texture study" },
];

// Height at which the gallery is clipped in collapsed state (px).
// Generous enough to show several full rows and feel abundant.
const COLLAPSED_HEIGHT = 820;

export function GalleryGrid() {
  const [expanded, setExpanded]   = useState(false);
  const [active, setActive]       = useState<GalleryImage | null>(null);
  // Track actual rendered height so we know whether to show the reveal UI
  const gridRef = useRef<HTMLDivElement>(null);
  const [needsReveal, setNeedsReveal] = useState(false);

  useEffect(() => {
    if (!gridRef.current) return;
    setNeedsReveal(gridRef.current.scrollHeight > COLLAPSED_HEIGHT);
  }, []);

  // Keyboard: Escape closes lightbox
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft")  navigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = active ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  function navigate(dir: 1 | -1) {
    if (!active) return;
    const i = IMAGES.findIndex((img) => img.id === active.id);
    setActive(IMAGES[(i + dir + IMAGES.length) % IMAGES.length]);
  }

  return (
    <>
      {/* ── Masonry grid ──────────────────────────────────────────────── */}
      <div className="relative">
        <div
          ref={gridRef}
          // overflow-hidden clips the grid; max-height drives the reveal animation
          className="columns-2 md:columns-3 lg:columns-4 gap-3 overflow-hidden"
          style={{
            maxHeight: expanded ? gridRef.current?.scrollHeight ?? "9999px" : COLLAPSED_HEIGHT,
            transition: "max-height 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {IMAGES.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(img)}
              // break-inside-avoid keeps each card whole within a column
              className="mb-3 break-inside-avoid block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                // Very subtle scale — keeps it editorial, not e-commerce
                className="w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.03]"
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
        </div>

        {/* Soft gradient veil — visible only when collapsed */}
        {needsReveal && (
          <div
            aria-hidden
            className={`
              pointer-events-none absolute inset-x-0 bottom-0 h-64
              bg-gradient-to-t from-white via-white/70 to-transparent
              dark:from-gray-950 dark:via-gray-950/70
              transition-opacity duration-700
              ${expanded ? "opacity-0" : "opacity-100"}
            `}
          />
        )}

        {/* Expand / collapse button — floats over the veil */}
        {needsReveal && (
          <div
            className={`
              absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-8
              transition-all duration-500
              ${expanded ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 translate-y-0"}
            `}
          >
            <p className="text-[11px] tracking-widest uppercase text-gray-400 dark:text-gray-500 font-medium">
              Looking for something specific? We can source beyond what is shown.
            </p>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(true)}
              className="
                group inline-flex items-center gap-2.5
                border border-gray-300 dark:border-gray-700
                bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm
                hover:border-emerald-500 dark:hover:border-emerald-600
                text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400
                px-6 py-2.5 rounded-full text-sm font-medium
                shadow-sm hover:shadow-md
                transition-all duration-300
              "
            >
              View Full Gallery
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="transition-transform duration-300 group-hover:translate-y-0.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Collapse button — appears below the fully expanded grid */}
      {needsReveal && expanded && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(false)}
            className="
              inline-flex items-center gap-2 text-xs tracking-widest uppercase
              text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300
              transition-colors duration-200
            "
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="rotate-180"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Show Less
          </button>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image viewer"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="relative flex max-h-[92vh] max-w-4xl w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={active.id}
              src={active.src}
              alt={active.alt}
              draggable={false}
              className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl select-none pointer-events-none"
            />

            {/* Watermark — centered over image */}
            <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/watermark3.svg"
                alt=""
                aria-hidden
                draggable={false}
                className="w-44 sm:w-60 opacity-60 pointer-events-none select-none"
              />
            </div>

            {/* Close */}
            <button
              type="button"
              aria-label="Close viewer"
              onClick={() => setActive(null)}
              className="absolute -top-11 right-0 text-white/50 hover:text-white transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Counter */}
            <span className="absolute -top-10 left-0 text-xs text-white/40 tracking-widest tabular-nums">
              {IMAGES.findIndex((img) => img.id === active.id) + 1} / {IMAGES.length}
            </span>

            {/* Prev */}
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => navigate(-1)}
              className="absolute -left-14 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-2"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Next */}
            <button
              type="button"
              aria-label="Next image"
              onClick={() => navigate(1)}
              className="absolute -right-14 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-2"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
