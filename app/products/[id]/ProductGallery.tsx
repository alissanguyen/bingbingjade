"use client";

import { useState } from "react";

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export function ProductGallery({ images, videos }: { images: string[]; videos: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeType, setActiveType] = useState<"image" | "video">("image");

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

  return (
    <div className="flex flex-col gap-3">
      {/* Main view */}
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
        {activeType === "image" ? (
          <img
            src={images[activeIndex]}
            alt="Product"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={videos[activeIndex]}
            controls
            autoPlay
            className="w-full h-full object-cover"
          />
        )}
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
  );
}
