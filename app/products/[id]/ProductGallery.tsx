"use client";

import { useState, useEffect, useCallback } from "react";

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

type MediaItem = { type: "image"; src: string } | { type: "video"; src: string };

export function ProductGallery({ images, videos }: { images: string[]; videos: string[] }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const all: MediaItem[] = [
    ...images.map((src) => ({ type: "image" as const, src })),
    ...videos.map((src) => ({ type: "video" as const, src })),
  ];

  const total = all.length;

  const prev = useCallback(() => setCurrent((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % total), [total]);

  // Keyboard navigation when lightbox is open
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, prev, next]);

  if (total === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-6xl">
        🪨
      </div>
    );
  }

  const active = all[current];

  const ArrowButton = ({
    direction,
    onClick,
    lightbox = false,
  }: {
    direction: "prev" | "next";
    onClick: (e: React.MouseEvent) => void;
    lightbox?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-all ${
        direction === "prev" ? "left-2" : "right-2"
      } ${
        lightbox
          ? "w-11 h-11 bg-white/10 hover:bg-white/25 text-white"
          : "w-9 h-9 bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100"
      }`}
    >
      {direction === "prev" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );

  return (
    <>
      {/* ── Carousel ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Main slide */}
        <div
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          {active.type === "image" ? (
            <img src={active.src} alt="Product" className="w-full h-full object-cover" />
          ) : (
            <video src={active.src} className="w-full h-full object-cover" />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />

          {/* Arrows (only when multiple) */}
          {total > 1 && (
            <>
              <ArrowButton direction="prev" onClick={(e) => { e.stopPropagation(); prev(); }} />
              <ArrowButton direction="next" onClick={(e) => { e.stopPropagation(); next(); }} />
            </>
          )}

          {/* Dot indicators */}
          {total > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {all.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === current ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Video badge */}
          {active.type === "video" && (
            <div className="absolute top-2.5 left-2.5 bg-black/50 text-white rounded-full p-1.5">
              <PlayIcon />
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {total > 1 && (
          <div className="flex gap-2 flex-wrap">
            {all.map((item, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  i === current
                    ? "border-emerald-500 opacity-100"
                    : "border-transparent opacity-55 hover:opacity-90"
                }`}
              >
                {item.type === "image" ? (
                  <img src={item.src} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                    <PlayIcon />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <CloseIcon />
          </button>

          {/* Counter */}
          {total > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-white/50 tabular-nums z-10">
              {current + 1} / {total}
            </div>
          )}

          {/* Media */}
          <div
            className="relative flex items-center justify-center max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {active.type === "image" ? (
              <img
                src={active.src}
                alt="Product"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={active.src}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
            )}

            {/* Lightbox arrows */}
            {total > 1 && (
              <>
                <ArrowButton direction="prev" onClick={(e) => { e.stopPropagation(); prev(); }} lightbox />
                <ArrowButton direction="next" onClick={(e) => { e.stopPropagation(); next(); }} lightbox />
              </>
            )}
          </div>

          {/* Dot indicators */}
          {total > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {all.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === current ? "bg-white scale-125" : "bg-white/35 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
