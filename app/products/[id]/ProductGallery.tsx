"use client";

import { useState } from "react";

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
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

export function ProductGallery({ images, videos }: { images: string[]; videos: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeType, setActiveType] = useState<"image" | "video">("image");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasMedia = images.length > 0 || videos.length > 0;

  if (!hasMedia) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-6xl">
        🪨
      </div>
    );
  }

  const allThumbs = [
    ...images.map((src, i) => ({ type: "image" as const, src, i })),
    ...videos.map((src, i) => ({ type: "video" as const, src, i })),
  ];

  const activeSrc = activeType === "image" ? images[activeIndex] : videos[activeIndex];

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Main view */}
        <div
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-zoom-in group"
          onClick={() => setLightboxOpen(true)}
        >
          {activeType === "image" ? (
            <img
              src={activeSrc}
              alt="Product"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={activeSrc}
              className="w-full h-full object-cover"
            />
          )}
          {/* Expand hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded-full p-2.5">
              <ExpandIcon />
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        {allThumbs.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {allThumbs.map((thumb) => {
              const isActive = activeType === thumb.type && activeIndex === thumb.i;
              return (
                <button
                  key={`${thumb.type}-${thumb.i}`}
                  onClick={() => { setActiveType(thumb.type); setActiveIndex(thumb.i); }}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                    isActive
                      ? "border-emerald-500 opacity-100"
                      : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  {thumb.type === "image" ? (
                    <img src={thumb.src} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white">
                      <PlayIcon />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <CloseIcon />
          </button>

          {/* Media — stop propagation so clicking media doesn't close */}
          <div
            className="max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {activeType === "image" ? (
              <img
                src={activeSrc}
                alt="Product"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={activeSrc}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
