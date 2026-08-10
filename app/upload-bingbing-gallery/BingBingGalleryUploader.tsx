"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageCropModal } from "@/app/add/MediaCroppers";
import { LogoPositionPicker } from "./LogoPositionPicker";

interface GalleryImage {
  id: string;
  storage_path: string;
  logo_x: number;
  logo_y: number;
  sort_order: number;
  published: boolean;
  url: string;
}

interface QueueItem {
  key: string;
  file: File;
  previewUrl: string;
  stage: "pending" | "positioned" | "uploading" | "error";
  xPercent: number;
  yPercent: number;
  progress: number;
  errorMessage?: string;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 20 * 1024 * 1024;

function uploadWithProgress(file: File, xPercent: number, yPercent: number, onProgress: (pct: number) => void): Promise<{ image: GalleryImage } | { error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/bingbing-gallery/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve({ image: data.image });
        else resolve({ error: data.error ?? "Upload failed." });
      } catch {
        resolve({ error: "Upload failed." });
      }
    };
    xhr.onerror = () => resolve({ error: "Upload failed. Please check your connection and try again." });
    const formData = new FormData();
    formData.append("image", file);
    formData.append("xPercent", String(xPercent));
    formData.append("yPercent", String(yPercent));
    xhr.send(formData);
  });
}

export function BingBingGalleryUploader() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [cropTarget, setCropTarget] = useState<{ key: string; src: string; fileName: string } | null>(null);
  const [positionTarget, setPositionTarget] = useState<{ key: string; src: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const res = await fetch("/api/admin/bingbing-gallery");
      const data = await res.json();
      if (res.ok) setImages(data.images ?? []);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  function handleSelectFiles(files: FileList | null) {
    if (!files?.length) return;
    const newItems: QueueItem[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.has(file.type)) continue;
      if (file.size > MAX_BYTES) continue;
      newItems.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        stage: "pending",
        xPercent: 50,
        yPercent: 50,
        progress: 0,
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  }

  function openCrop(item: QueueItem) {
    setCropTarget({ key: item.key, src: item.previewUrl, fileName: item.file.name });
  }

  function handleCropConfirm(croppedFile: File) {
    if (!cropTarget) return;
    const key = cropTarget.key;
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, file: croppedFile, previewUrl: URL.createObjectURL(croppedFile) } : i))
    );
    setCropTarget(null);
    // Immediately move into the position-picking step for this item.
    setPositionTarget({ key, src: URL.createObjectURL(croppedFile) });
  }

  function openPosition(item: QueueItem) {
    setPositionTarget({ key: item.key, src: item.previewUrl });
  }

  function handlePositionConfirm(pos: { xPercent: number; yPercent: number }) {
    if (!positionTarget) return;
    const key = positionTarget.key;
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, stage: "positioned", xPercent: pos.xPercent, yPercent: pos.yPercent } : i)));
    setPositionTarget(null);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleUploadAll() {
    const ready = items.filter((i) => i.stage === "positioned");
    if (ready.length === 0) return;
    setUploading(true);
    for (const item of ready) {
      setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, stage: "uploading" } : i)));
      const result = await uploadWithProgress(item.file, item.xPercent, item.yPercent, (pct) => {
        setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, progress: pct } : i)));
      });
      if ("error" in result) {
        setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, stage: "error", errorMessage: result.error } : i)));
      } else {
        setItems((prev) => prev.filter((i) => i.key !== item.key));
        setImages((prev) => [...prev, result.image]);
      }
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this gallery image?")) return;
    const res = await fetch(`/api/admin/bingbing-gallery/${id}`, { method: "DELETE" });
    if (res.ok) setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleTogglePublished(img: GalleryImage) {
    const res = await fetch(`/api/admin/bingbing-gallery/${img.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !img.published }),
    });
    if (res.ok) {
      const data = await res.json();
      setImages((prev) => prev.map((i) => (i.id === img.id ? data.image : i)));
    }
  }

  async function handleReorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const a = images[index];
    const b = images[target];
    const [resA, resB] = await Promise.all([
      fetch(`/api/admin/bingbing-gallery/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/admin/bingbing-gallery/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ]);
    if (resA.ok && resB.ok) {
      const next = [...images];
      [next[index], next[target]] = [next[target], next[index]];
      setImages(next);
    }
  }

  const readyCount = items.filter((i) => i.stage === "positioned").length;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-gray-300">1. Upload photos</h2>
        <div
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className="rounded-xl border-2 border-dashed border-stone-300 dark:border-gray-700 hover:border-emerald-400 px-4 py-8 text-center cursor-pointer transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => {
              handleSelectFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-sm text-stone-600 dark:text-gray-400">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Click to select photos</span> from your phone or computer
          </p>
          <p className="mt-1 text-xs text-stone-400 dark:text-gray-600">JPEG, PNG, WebP, or HEIC — crop and place the logo on each before uploading</p>
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.key} className="relative rounded-lg overflow-hidden border border-stone-200 dark:border-gray-700 bg-stone-100 dark:bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="Queued upload" className="w-full aspect-square object-cover" />

                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  aria-label="Remove"
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-xs leading-none"
                >
                  ×
                </button>

                {item.stage === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-[11px] gap-1">
                    <span>{item.progress}%</span>
                  </div>
                )}

                {item.stage === "error" && (
                  <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center text-white text-[10px] p-1.5 text-center">
                    {item.errorMessage ?? "Upload failed"}
                  </div>
                )}

                {(item.stage === "pending" || item.stage === "positioned") && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 flex divide-x divide-white/20">
                    <button type="button" onClick={() => openCrop(item)} className="flex-1 py-1.5 text-[11px] text-white hover:bg-black/40">
                      Crop
                    </button>
                    <button type="button" onClick={() => openPosition(item)} className="flex-1 py-1.5 text-[11px] text-white hover:bg-black/40">
                      {item.stage === "positioned" ? "Logo ✓" : "Set logo"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={readyCount === 0 || uploading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : `Upload ${readyCount} ready photo${readyCount === 1 ? "" : "s"}`}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-gray-300">Gallery images</h2>
        {loadingImages ? (
          <p className="text-sm text-stone-400 dark:text-gray-600">Loading…</p>
        ) : images.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-gray-600">No images uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div key={img.id} className="relative rounded-lg overflow-hidden border border-stone-200 dark:border-gray-700 bg-stone-100 dark:bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Gallery" className="w-full aspect-square object-cover" />
                {!img.published && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">Hidden</div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 flex flex-wrap divide-x divide-white/20 text-[10px] text-white">
                  <button type="button" onClick={() => handleReorder(idx, -1)} disabled={idx === 0} className="flex-1 py-1 hover:bg-black/40 disabled:opacity-40">‹</button>
                  <button type="button" onClick={() => handleReorder(idx, 1)} disabled={idx === images.length - 1} className="flex-1 py-1 hover:bg-black/40 disabled:opacity-40">›</button>
                  <button type="button" onClick={() => handleTogglePublished(img)} className="flex-1 py-1 hover:bg-black/40">
                    {img.published ? "Hide" : "Show"}
                  </button>
                  <button type="button" onClick={() => handleDelete(img.id)} className="flex-1 py-1 hover:bg-black/40">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {cropTarget && (
        <ImageCropModal
          src={cropTarget.src}
          fileName={cropTarget.fileName}
          onConfirm={handleCropConfirm}
          onClose={() => setCropTarget(null)}
        />
      )}

      {positionTarget && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 max-w-md w-full space-y-4">
            <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300">Place the BingBing logo</h3>
            <LogoPositionPicker
              src={positionTarget.src}
              initialX={items.find((i) => i.key === positionTarget.key)?.xPercent ?? 50}
              initialY={items.find((i) => i.key === positionTarget.key)?.yPercent ?? 50}
              onChange={(pos) => {
                const key = positionTarget.key;
                setItems((prev) => prev.map((i) => (i.key === key ? { ...i, xPercent: pos.xPercent, yPercent: pos.yPercent } : i)));
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const item = items.find((i) => i.key === positionTarget.key);
                  if (item) handlePositionConfirm({ xPercent: item.xPercent, yPercent: item.yPercent });
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Confirm position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
