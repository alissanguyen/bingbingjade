"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface GalleryImage {
  id: string;
  thumbUrl: string;
  fullUrl: string;
}

const INITIAL_COUNT = 8;

// Lightweight deterrence only — not true DRM, matches the pattern used on
// product pages (app/products/[slug]/ProductGallery.tsx). Raises friction
// for casual right-click saves / drag-and-drop copying.
function blockContextMenu(e: React.MouseEvent) { e.preventDefault(); }
function blockDrag(e: React.DragEvent) { e.preventDefault(); }

export function BingBingGalleryClient({ images }: { images: GalleryImage[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasMore = images.length > INITIAL_COUNT;
  const active = images.find((img) => img.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
      if (e.key === "ArrowLeft") {
        const i = images.findIndex((img) => img.id === active.id);
        setActiveId(images[(i - 1 + images.length) % images.length].id);
      }
      if (e.key === "ArrowRight") {
        const i = images.findIndex((img) => img.id === active.id);
        setActiveId(images[(i + 1) % images.length].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, images]);

  useEffect(() => {
    document.body.style.overflow = active ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  if (images.length === 0) {
    return <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-16">No photos yet — check back soon.</p>;
  }

  return (
    <>
      <div className="relative" onContextMenu={blockContextMenu}>
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
          {(expanded ? images : images.slice(0, INITIAL_COUNT)).map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveId(img.id)}
              className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl group block w-full text-left select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {/* Transparent overlay — blocks right-click save even through pointer-events-none image below */}
              <div className="absolute inset-0 z-1 pointer-events-auto" onContextMenu={blockContextMenu} />
              <Image
                src={img.thumbUrl}
                alt="BingBing Jade"
                width={600}
                height={600}
                unoptimized
                className="w-full h-auto object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading="lazy"
                draggable={false}
                onDragStart={blockDrag}
              />
            </button>
          ))}
        </div>

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

      {active && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setActiveId(null)}
          onContextMenu={blockContextMenu}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 z-1 pointer-events-auto" onContextMenu={blockContextMenu} />
            <Image
              src={active.fullUrl}
              alt="BingBing Jade"
              width={1200}
              height={1200}
              unoptimized
              className="max-w-full max-h-[85vh] w-auto h-auto rounded-2xl object-contain shadow-2xl select-none pointer-events-none"
              sizes="90vw"
              loading="eager"
              draggable={false}
              onDragStart={blockDrag}
            />

            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="Close"
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>

            <button
              type="button"
              aria-label="Previous"
              onClick={() => {
                const i = images.findIndex((img) => img.id === active.id);
                setActiveId(images[(i - 1 + images.length) % images.length].id);
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
                const i = images.findIndex((img) => img.id === active.id);
                setActiveId(images[(i + 1) % images.length].id);
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
