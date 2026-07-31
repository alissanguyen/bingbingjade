"use client";

import { useCallback, useRef, useState } from "react";

export interface UploadedAttachment {
  id: string;
  previewUrl: string | null;
  originalFilename: string | null;
  uploadedBy: string;
}

interface UploadItem {
  key: string;
  file: File;
  localPreview: string;
  status: "uploading" | "done" | "error";
  progress: number;
  errorMessage?: string;
  attachment?: UploadedAttachment;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 20 * 1024 * 1024;

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<{ attachment: UploadedAttachment } | { error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve({ attachment: data.attachment });
        else resolve({ error: data.error ?? "Upload failed." });
      } catch {
        resolve({ error: "Upload failed." });
      }
    };
    xhr.onerror = () => resolve({ error: "Upload failed. Please check your connection and try again." });
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function ServiceRequestImageUploader({
  getServiceRequestId,
  uploadUrl,
  deleteUrl,
  minImages,
  maxImages,
  initialAttachments = [],
  onChange,
  disabled,
}: {
  getServiceRequestId: () => Promise<string>;
  uploadUrl: (serviceRequestId: string) => string;
  deleteUrl?: (serviceRequestId: string, attachmentId: string) => string;
  minImages: number;
  maxImages: number;
  initialAttachments?: UploadedAttachment[];
  onChange: (attachments: UploadedAttachment[]) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<UploadItem[]>(
    initialAttachments.map((a) => ({ key: a.id, file: new File([], a.originalFilename ?? "photo"), localPreview: a.previewUrl ?? "", status: "done", progress: 100, attachment: a }))
  );
  const [dragActive, setDragActive] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneCount = items.filter((i) => i.status === "done").length;
  const canAddMore = doneCount + items.filter((i) => i.status === "uploading").length < maxImages;

  const notifyChange = useCallback((next: UploadItem[]) => {
    onChange(next.filter((i) => i.status === "done" && i.attachment).map((i) => i.attachment!));
  }, [onChange]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setGlobalError(null);
      const fileArray = Array.from(files);
      const remainingSlots = maxImages - (doneCount + items.filter((i) => i.status === "uploading").length);

      if (remainingSlots <= 0) {
        setGlobalError(`You can upload up to ${maxImages} photos.`);
        return;
      }

      const toProcess = fileArray.slice(0, remainingSlots);
      if (fileArray.length > toProcess.length) {
        setGlobalError(`Only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} can be added (max ${maxImages}).`);
      }

      const validated: { file: File; key: string; error?: string }[] = toProcess.map((file) => {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (!ALLOWED_TYPES.has(file.type)) {
          return { file, key, error: "Unsupported file type. Please use JPEG, PNG, WebP, or HEIC." };
        }
        if (file.size > MAX_BYTES) {
          return { file, key, error: "File is too large (max 20MB)." };
        }
        return { file, key };
      });

      const newItems: UploadItem[] = validated.map((v) => ({
        key: v.key,
        file: v.file,
        localPreview: URL.createObjectURL(v.file),
        status: v.error ? "error" : "uploading",
        progress: 0,
        errorMessage: v.error,
      }));

      setItems((prev) => [...prev, ...newItems]);

      let serviceRequestId: string;
      try {
        serviceRequestId = await getServiceRequestId();
      } catch {
        setItems((prev) => prev.map((i) => (newItems.some((n) => n.key === i.key) ? { ...i, status: "error", errorMessage: "Could not start your request. Please try again." } : i)));
        return;
      }

      for (const v of validated) {
        if (v.error) continue;
        const result = await uploadWithProgress(uploadUrl(serviceRequestId), v.file, (pct) => {
          setItems((prev) => prev.map((i) => (i.key === v.key ? { ...i, progress: pct } : i)));
        });
        setItems((prev) => {
          const next = prev.map((i) =>
            i.key === v.key
              ? "error" in result
                ? { ...i, status: "error" as const, errorMessage: result.error }
                : { ...i, status: "done" as const, progress: 100, attachment: result.attachment }
              : i
          );
          notifyChange(next);
          return next;
        });
      }
    },
    [doneCount, items, maxImages, getServiceRequestId, uploadUrl, notifyChange]
  );

  async function handleRemove(item: UploadItem) {
    if (item.attachment && deleteUrl) {
      try {
        const serviceRequestId = await getServiceRequestId();
        await fetch(deleteUrl(serviceRequestId, item.attachment.id), { method: "DELETE" });
      } catch {
        /* best-effort — still remove from UI */
      }
    }
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== item.key);
      notifyChange(next);
      return next;
    });
  }

  async function handleRetry(item: UploadItem) {
    setItems((prev) => prev.filter((i) => i.key !== item.key));
    await uploadFiles([item.file]);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      notifyChange(next);
      return next;
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-stone-700 dark:text-gray-300">Upload photos of your jade item</p>
        <p className="mt-1 text-xs text-stone-500 dark:text-gray-400 leading-relaxed">
          Add 1–5 clear images showing the full piece and any lines, cracks, chips, scratches, or areas of concern.
          Photos are required so we can review whether the requested service may be suitable. Please do not ship your
          item until your request is approved.
        </p>
        <p className="mt-1.5 text-[11px] text-stone-400 dark:text-gray-600 leading-relaxed">
          Helpful shots: full view of the item &middot; front and back &middot; inner and outer rim for bangles
          &middot; close-ups of any damage &middot; existing silver or gold wrapping, if applicable.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !disabled && canAddMore && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${disabled || !canAddMore
          ? "border-stone-200 dark:border-gray-800 opacity-60 cursor-not-allowed"
          : dragActive
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 cursor-pointer"
            : "border-stone-300 dark:border-gray-700 hover:border-emerald-400 cursor-pointer"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={disabled || !canAddMore}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-stone-600 dark:text-gray-400">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-stone-400 dark:text-gray-600">
          {doneCount}/{maxImages} photos &middot; JPEG, PNG, WebP, or HEIC
        </p>
      </div>

      {globalError && <p className="text-xs text-red-600 dark:text-red-400">{globalError}</p>}

      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {items.map((item, idx) => (
            <div key={item.key} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 dark:border-gray-700 bg-stone-100 dark:bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.attachment?.previewUrl ?? item.localPreview} alt="Uploaded jade item" className="h-full w-full object-cover" />

              {item.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-[11px] gap-1">
                  <span>{item.progress}%</span>
                  <div className="w-3/4 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              )}

              {item.status === "error" && (
                <div className="absolute inset-0 bg-red-900/70 flex flex-col items-center justify-center text-white text-[10px] p-1.5 text-center gap-1.5">
                  <span>{item.errorMessage ?? "Upload failed"}</span>
                  <button type="button" onClick={() => handleRetry(item)} className="underline underline-offset-2">Retry</button>
                </div>
              )}

              {item.status !== "uploading" && (
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-xs leading-none"
                >
                  ×
                </button>
              )}

              {item.status === "done" && items.length > 1 && (
                <div className="absolute bottom-1 left-1 flex gap-0.5">
                  {idx > 0 && (
                    <button type="button" onClick={() => moveItem(idx, -1)} aria-label="Move earlier" className="h-5 w-5 rounded bg-black/60 hover:bg-black/80 text-white text-[10px] flex items-center justify-center">
                      ‹
                    </button>
                  )}
                  {idx < items.length - 1 && (
                    <button type="button" onClick={() => moveItem(idx, 1)} aria-label="Move later" className="h-5 w-5 rounded bg-black/60 hover:bg-black/80 text-white text-[10px] flex items-center justify-center">
                      ›
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {doneCount < minImages && (
        <p className="text-xs text-stone-500 dark:text-gray-400">
          {minImages - doneCount} more photo{minImages - doneCount === 1 ? "" : "s"} required.
        </p>
      )}
    </div>
  );
}
