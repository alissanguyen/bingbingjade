"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Click-or-drag position picker for placing the BingBing logo on an image.
 * Interaction mirrors HeroImageEditor's focal-point picker in
 * app/collections-admin/[id]/CollectionAdminClient.tsx: percentage coords
 * relative to the rendered image box, rAF-throttled direct-DOM dot painting
 * during drag, and a single state commit on pointerup.
 */
export function LogoPositionPicker({
  src,
  initialX = 50,
  initialY = 50,
  onChange,
}: {
  src: string;
  initialX?: number;
  initialY?: number;
  onChange: (pos: { xPercent: number; yPercent: number }) => void;
}) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);

  const imgRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const livePos = useRef({ x: initialX, y: initialY });
  const isPointerDown = useRef(false);

  useEffect(() => {
    onChange({ xPercent: x, yPercent: y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);

  function paintDot(nx: number, ny: number) {
    if (dotRef.current) {
      dotRef.current.style.left = `${nx}%`;
      dotRef.current.style.top = `${ny}%`;
    }
  }

  function getCoordsFromEvent(e: PointerEvent): { x: number; y: number } | null {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    isPointerDown.current = true;
    imgRef.current?.setPointerCapture(e.pointerId);
    const coords = getCoordsFromEvent(e.nativeEvent);
    if (coords) {
      livePos.current = coords;
      paintDot(coords.x, coords.y);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPointerDown.current) return;
    e.preventDefault();
    const coords = getCoordsFromEvent(e.nativeEvent);
    if (!coords) return;
    livePos.current = coords;
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      paintDot(livePos.current.x, livePos.current.y);
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    const coords = getCoordsFromEvent(e.nativeEvent) ?? livePos.current;
    setX(coords.x);
    setY(coords.y);
  }

  function handlePointerCancel() {
    isPointerDown.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500 dark:text-gray-400">Click or drag on the image to place the logo.</p>
      <div
        ref={imgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative w-full rounded-lg overflow-hidden border border-stone-200 dark:border-gray-700 cursor-crosshair select-none"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Position preview" className="w-full h-auto block pointer-events-none select-none" draggable={false} />
        <div
          ref={dotRef}
          className="absolute h-6 w-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-emerald-500/80 shadow-lg pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </div>
      <p className="text-[11px] text-stone-400 dark:text-gray-600">
        Position: {x.toFixed(1)}%, {y.toFixed(1)}%
      </p>
    </div>
  );
}
