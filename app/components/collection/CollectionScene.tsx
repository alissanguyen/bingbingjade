"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { productThumbUrl } from "@/lib/storage";
import { requiresInquiry } from "@/lib/price";

interface TagProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
  price_display_usd: number | null;
  sale_price_usd: number | null;
  show_price: boolean;
  status: string;
}

interface SceneTag {
  id: string;
  x: number;
  y: number;
  mobile_x?: number | null;
  mobile_y?: number | null;
  products: TagProduct;
}

interface Scene {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  caption: string | null;
  tags: SceneTag[];
}

interface Props {
  scene: Scene;
}

function formatPrice(p: TagProduct): string | null {
  if (!p.show_price) return null;
  const price = p.sale_price_usd ?? p.price_display_usd;
  if (price == null) return null;
  if (requiresInquiry(price)) return "Inquire for Pricing";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function TagDot({
  tag,
  isMobile,
  activeTagId,
  setActiveTagId,
  hoverTagId,
  setHoverTagId,
}: {
  tag: SceneTag;
  isMobile: boolean;
  activeTagId: string | null;
  setActiveTagId: (id: string | null) => void;
  hoverTagId: string | null;
  setHoverTagId: (id: string | null) => void;
}) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openHover() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setHoverTagId(tag.id);
  }

  function closeHover() {
    closeTimer.current = setTimeout(() => setHoverTagId(null), 200);
  }

  const product = tag.products;
  const thumb = product.images?.[0] ? productThumbUrl(product.images[0]) : null;
  const price = formatPrice(product);
  const isSold = product.status === "sold";

  const posX = isMobile && tag.mobile_x != null ? tag.mobile_x : tag.x;
  const posY = isMobile && tag.mobile_y != null ? tag.mobile_y : tag.y;

  const open = isMobile ? activeTagId === tag.id : hoverTagId === tag.id;

  const popupLeft = posX > 60;
  const popupTop = posY > 65;

  const handleDotClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMobile) return;
    setActiveTagId(activeTagId === tag.id ? null : tag.id);
  }, [isMobile, tag.id, activeTagId, setActiveTagId]);

  const cardContent = (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {thumb && (
        <div className="relative w-full aspect-square bg-gray-50 dark:bg-gray-800">
          <Image src={thumb} alt={product.name} fill className="object-cover" unoptimized />
          {isSold && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs font-semibold tracking-widest uppercase">Sold</span>
            </div>
          )}
        </div>
      )}
      <div className="px-3 py-2.5">
        <p className="text-xs font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">{product.name}</p>
        {price && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{price}</p>}
        {!isSold && (
          <Link
            href={`/products/${product.slug}`}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            View piece
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="absolute"
      style={{ left: `${posX}%`, top: `${posY}%`, transform: "translate(-50%, -50%)" }}
    >
      <button
        onClick={handleDotClick}
        onMouseEnter={() => !isMobile && openHover()}
        onMouseLeave={() => !isMobile && closeHover()}
        aria-label={`View product: ${product.name}`}
        className="w-6 h-6 rounded-full border-2 border-white bg-white/20 backdrop-blur-sm hover:bg-white/40 transition-all flex items-center justify-center shadow-sm group"
      >
        <span className="w-2 h-2 rounded-full bg-white group-hover:scale-110 transition-transform" />
      </button>

      {/* Desktop: absolute card, edge-aware, hover-controlled — behavior unchanged */}
      {!isMobile && open && (
        <div
          className={`absolute z-20 w-52 pointer-events-auto ${popupLeft ? "right-8" : "left-8"} ${popupTop ? "bottom-0" : "top-0"}`}
          onMouseEnter={() => openHover()}
          onMouseLeave={() => closeHover()}
        >
          {cardContent}
        </div>
      )}

      {/* Mobile: fixed overlay at bottom of viewport — never clipped, has × close button */}
      {isMobile && open && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            {cardContent}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveTagId(null); }}
              aria-label="Close"
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-sm flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CollectionScene({ scene }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [hoverTagId, setHoverTagId] = useState<string | null>(null);
  const hasActiveTag = activeTagId !== null || hoverTagId !== null;

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!activeTagId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveTagId(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeTagId]);

  const hasTags = scene.tags.length > 0;

  return (
    <figure className={`relative group ${hasActiveTag ? "z-50" : ""}`}>
      <div
        ref={containerRef}
        className="relative w-full"
        onClick={() => activeTagId && setActiveTagId(null)}
      >
        <picture>
          {scene.mobileImageUrl && (
            <source media="(max-width: 639px)" srcSet={scene.mobileImageUrl} />
          )}
          <Image
            src={scene.imageUrl}
            alt={scene.caption ?? "Collection scene"}
            width={1400}
            height={900}
            className="w-full h-auto object-cover"
            unoptimized
          />
        </picture>

        {hasTags && scene.tags.map((tag) => (
          <TagDot
            key={tag.id}
            tag={tag}
            isMobile={isMobile}
            activeTagId={activeTagId}
            setActiveTagId={setActiveTagId}
            hoverTagId={hoverTagId}
            setHoverTagId={setHoverTagId}
          />
        ))}

        {hasTags && (
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white" aria-hidden>
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span className="text-white text-[10px] font-medium">{scene.tags.length} piece{scene.tags.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </div>

      {scene.caption && (
        <figcaption className="mt-2 px-1 text-xs text-gray-400 dark:text-gray-500 italic leading-relaxed">
          {scene.caption}
        </figcaption>
      )}
    </figure>
  );
}
