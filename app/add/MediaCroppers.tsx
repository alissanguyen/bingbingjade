"use client";

import { useState, useCallback, useRef } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

// ── helpers ───────────────────────────────────────────────────────────────────

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

async function cropImageFile(src: string, pixelCrop: Area, originalName: string): Promise<File> {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const name = originalName.replace(/\.[^.]+$/, "_cropped.jpg");
      resolve(new File([blob!], name, { type: "image/jpeg" }));
    }, "image/jpeg", 0.95);
  });
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

// ── FreeCropSelector ──────────────────────────────────────────────────────────
// Custom drag-to-select for free aspect crop (react-easy-crop doesn't support it)

function FreeCropSelector({
  src,
  onPixelsChange,
}: {
  src: string;
  onPixelsChange: (pixels: Area | null) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number } | null>(null);

  const imgPos = (e: React.MouseEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(e.clientY - r.top, r.height)),
    };
  };

  const toPixelArea = (s: { x: number; y: number; w: number; h: number }): Area => {
    const img = imgRef.current!;
    const r = img.getBoundingClientRect();
    const kx = img.naturalWidth / r.width;
    const ky = img.naturalHeight / r.height;
    return {
      x: Math.round(s.x * kx),
      y: Math.round(s.y * ky),
      width: Math.round(s.w * kx),
      height: Math.round(s.h * ky),
    };
  };

  const calcSel = (e: React.MouseEvent) => {
    if (!drag.current) return null;
    const { x, y } = imgPos(e);
    const nx = Math.min(x, drag.current.sx);
    const ny = Math.min(y, drag.current.sy);
    const nw = Math.abs(x - drag.current.sx);
    const nh = Math.abs(y - drag.current.sy);
    return nw > 4 && nh > 4 ? { x: nx, y: ny, w: nw, h: nh } : null;
  };

  return (
    <div className="bg-black flex items-center justify-center" style={{ height: 380 }}>
      <div
        className="relative cursor-crosshair select-none"
        onMouseDown={(e) => {
          e.preventDefault();
          const { x, y } = imgPos(e);
          drag.current = { sx: x, sy: y };
          setSel(null);
          onPixelsChange(null);
        }}
        onMouseMove={(e) => {
          const newSel = calcSel(e);
          if (newSel) setSel(newSel);
        }}
        onMouseUp={(e) => {
          const newSel = calcSel(e);
          drag.current = null;
          setSel(newSel);
          onPixelsChange(newSel ? toPixelArea(newSel) : null);
        }}
        onMouseLeave={() => { drag.current = null; }}
      >
        <img
          ref={imgRef}
          src={src}
          alt="Select crop area"
          className="block pointer-events-none"
          style={{ maxWidth: "100%", maxHeight: 380 }}
          draggable={false}
        />
        {sel ? (
          <div
            className="absolute border-2 border-white pointer-events-none"
            style={{
              left: sel.x,
              top: sel.y,
              width: sel.w,
              height: sel.h,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white text-sm bg-black/55 px-3 py-1.5 rounded-full">
              Click and drag to select crop area
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ImageCropModal ─────────────────────────────────────────────────────────────

const ASPECTS = [
  { label: "Free", value: undefined as number | undefined },
  { label: "1:1",  value: 1 },
  { label: "4:3",  value: 4 / 3 },
  { label: "3:4",  value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

interface ImageCropModalProps {
  src: string;
  fileName: string;
  onConfirm: (file: File) => void;
  onClose: () => void;
}

export function ImageCropModal({ src, fileName, onConfirm, onClose }: ImageCropModalProps) {
  const [aspect, setAspect] = useState<number | undefined>(1);

  // Fixed-aspect state (react-easy-crop)
  const [fixedCrop, setFixedCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fixedPixels, setFixedPixels] = useState<Area | null>(null);
  const onCropComplete = useCallback((_: Area, pixels: Area) => setFixedPixels(pixels), []);

  // Free-crop state (custom drag selector)
  const [freePixels, setFreePixels] = useState<Area | null>(null);

  const [loading, setLoading] = useState(false);

  const isFree = aspect === undefined;
  const croppedPixels = isFree ? freePixels : fixedPixels;

  const handleAspectChange = (value: number | undefined) => {
    setAspect(value);
    setFixedPixels(null);
    setFreePixels(null);
  };

  const handleConfirm = async () => {
    if (!croppedPixels) return;
    setLoading(true);
    try {
      const file = await cropImageFile(src, croppedPixels, fileName);
      onConfirm(file);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="relative w-full max-w-2xl bg-gray-950 rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Crop Image</h2>
          <div className="flex items-center gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => handleAspectChange(a.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  aspect === a.value
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Crop area */}
        {isFree ? (
          <FreeCropSelector src={src} onPixelsChange={setFreePixels} />
        ) : (
          <div className="relative bg-black" style={{ height: 380 }}>
            <Cropper
              image={src}
              crop={fixedCrop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setFixedCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}

        {/* Zoom slider (only for fixed aspect) */}
        {!isFree && (
          <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
            <span className="text-xs text-gray-500 w-10">Zoom</span>
            <input
              type="range" min={1} max={3} step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-400 w-12 text-right">{zoom.toFixed(2)}×</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !croppedPixels}
            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            {loading ? "Cropping…" : "Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── VideoTrimModal ─────────────────────────────────────────────────────────────

interface VideoTrimModalProps {
  file: File;
  onConfirm: (file: File) => void;
  onClose: () => void;
}

export function VideoTrimModal({ file, onConfirm, onClose }: VideoTrimModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcUrl = useRef<string>(URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [trimming, setTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unsupported, setUnsupported] = useState(false);

  const handleLoadedMetadata = () => {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    setEndTime(d);
  };

  const seekTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const handleTrim = async () => {
    const video = videoRef.current;
    if (!video) return;

    const captureStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!captureStream) {
      setUnsupported(true);
      return;
    }

    setTrimming(true);
    setProgress(0);

    try {
      const stream = captureStream.call(video);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const name = file.name.replace(/\.[^.]+$/, "_trimmed.webm");
        onConfirm(new File([blob], name, { type: "video/webm" }));
        setTrimming(false);
      };

      video.currentTime = startTime;
      await new Promise<void>((r) => { video.onseeked = () => r(); });
      recorder.start();
      video.play();

      const trimDuration = endTime - startTime;
      const interval = setInterval(() => {
        if (!video) return;
        const elapsed = video.currentTime - startTime;
        setProgress(Math.min(100, (elapsed / trimDuration) * 100));
        if (video.currentTime >= endTime) {
          clearInterval(interval);
          video.pause();
          recorder.stop();
        }
      }, 100);
    } catch {
      setTrimming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="w-full max-w-2xl bg-gray-950 rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Trim Video</h2>
          <span className="text-xs text-gray-500 truncate max-w-xs">{file.name}</span>
        </div>

        {/* Video player */}
        <div className="bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src={srcUrl.current}
            onLoadedMetadata={handleLoadedMetadata}
            controls
            className="max-w-full"
            style={{ maxHeight: 300 }}
          />
        </div>

        {/* Range controls */}
        <div className="px-5 py-4 space-y-3.5 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-12">Start</span>
            <input
              type="range" min={0} max={duration} step={0.1}
              value={startTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStartTime(v);
                if (v >= endTime) setEndTime(Math.min(duration, v + 0.5));
                seekTo(v);
              }}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-300 w-16 text-right font-mono">{formatTime(startTime)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-12">End</span>
            <input
              type="range" min={0} max={duration} step={0.1}
              value={endTime}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEndTime(v);
                if (v <= startTime) setStartTime(Math.max(0, v - 0.5));
                seekTo(v);
              }}
              className="flex-1 accent-emerald-500"
            />
            <span className="text-xs text-gray-300 w-16 text-right font-mono">{formatTime(endTime)}</span>
          </div>

          {trimming && (
            <div className="space-y-1 pt-1">
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500">Trimming in real-time… {progress.toFixed(0)}%</p>
            </div>
          )}

          {unsupported && (
            <p className="text-xs text-red-400">
              Video capture isn&apos;t supported in this browser. Try Chrome or Firefox.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Selection: <span className="text-gray-300 font-mono">{formatTime(endTime - startTime)}</span>
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTrim}
              disabled={trimming || endTime <= startTime}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white disabled:opacity-50 transition-colors"
            >
              {trimming ? "Trimming…" : "Apply Trim"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
