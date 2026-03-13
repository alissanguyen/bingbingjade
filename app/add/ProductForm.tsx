"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createProduct } from "./actions";
import type { Vendor } from "@/types/vendor";
import type { ProductCategory } from "@/types/product";

interface Props {
  vendors: Vendor[];
}

const CATEGORIES: ProductCategory[] = ["bracelet", "bangle", "ring", "other"];

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

export function ProductForm({ vendors }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<{ file: File; preview: string | null }[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [imageDragging, setImageDragging] = useState(false);
  const [videoDragging, setVideoDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "other" as ProductCategory,
    color: "",
    tier: "",
    size: "",
    description: "",
    blemishes: "",
    price_display_usd: "",
    imported_price_vnd: "",
    vendor_id: vendors[0]?.id ?? "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const isHeic = file.name.toLowerCase().endsWith(".heic");
      const preview = isHeic ? null : URL.createObjectURL(file);
      setImages((prev) => [...prev, { file, preview }]);
    });
  };

  const removeImage = (i: number) => {
    setImages((prev) => {
      const url = prev[i].preview;
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const removeVideo = (i: number) => setVideos((prev) => prev.filter((_, idx) => idx !== i));

  const uploadFiles = async () => {
    const imageUrls: string[] = [];
    for (const { file } of images) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { data, error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw new Error(`Image upload failed: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(data.path);
      imageUrls.push(publicUrl);
    }

    const videoUrls: string[] = [];
    for (const file of videos) {
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { data, error } = await supabase.storage.from("product-videos").upload(path, file);
      if (error) throw new Error(`Video upload failed: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from("product-videos").getPublicUrl(data.path);
      videoUrls.push(publicUrl);
    }

    return { imageUrls, videoUrls };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const { imageUrls, videoUrls } = await uploadFiles();

      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("is_featured", String(isFeatured));
      imageUrls.forEach((url) => fd.append("imageUrls", url));
      videoUrls.forEach((url) => fd.append("videoUrls", url));

      const res = await createProduct(fd);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        setForm({ name: "", category: "other", color: "", tier: "", size: "", description: "", blemishes: "", price_display_usd: "", imported_price_vnd: "", vendor_id: vendors[0]?.id ?? "" });
        setImages([]);
        setVideos([]);
        setIsFeatured(false);
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Basic Info */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Basic Info</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Product Name <span className="text-red-400">*</span></label>
            <input required value={form.name} onChange={set("name")} placeholder="e.g. Imperial Green Bangle" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category <span className="text-red-400">*</span></label>
              <select required value={form.category} onChange={set("category")} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Vendor <span className="text-red-400">*</span></label>
              <select required value={form.vendor_id} onChange={set("vendor_id")} className={inputClass}>
                {vendors.length === 0 && <option value="">No vendors yet</option>}
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.platform})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Color <span className="text-red-400">*</span></label>
              <input required value={form.color} onChange={set("color")} placeholder="e.g. Imperial Green" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Tier <span className="text-red-400">*</span></label>
              <input required value={form.tier} onChange={set("tier")} placeholder="e.g. AAA" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Size <span className="text-red-400">*</span></label>
              <input required type="number" step="0.1" value={form.size} onChange={set("size")} placeholder="e.g. 54" className={inputClass} />
            </div>
          </div>
        </div>
      </section>

      {/* Media */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Media</h2>

        {/* Image Upload */}
        <div className="mb-6">
          <label className={labelClass}>Images (.heic, .jpg, .jpeg)</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
            onDragLeave={() => setImageDragging(false)}
            onDrop={(e) => { e.preventDefault(); setImageDragging(false); addImages(e.dataTransfer.files); }}
            onClick={() => imageInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
              imageDragging
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
          >
            <UploadIcon />
            <p className="text-sm text-gray-500 dark:text-gray-400">Drop images here or <span className="text-emerald-600 dark:text-emerald-400 font-medium">browse</span></p>
            <p className="text-xs text-gray-400 dark:text-gray-600">.heic · .jpg · .jpeg</p>
            <input ref={imageInputRef} type="file" multiple accept=".heic,.jpg,.jpeg,image/jpeg" className="hidden" onChange={(e) => addImages(e.target.files)} />
          </div>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map(({ file, preview }, i) => (
                <div key={i} className="relative group aspect-square">
                  {preview ? (
                    <img src={preview} alt={file.name} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-1 p-1">
                      <span className="text-lg">🪨</span>
                      <span className="text-[10px] text-gray-400 truncate w-full text-center">HEIC</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Upload */}
        <div>
          <label className={labelClass}>Videos (.mov)</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setVideoDragging(true); }}
            onDragLeave={() => setVideoDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setVideoDragging(false);
              const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".mov"));
              setVideos(prev => [...prev, ...files]);
            }}
            onClick={() => videoInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
              videoDragging
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
          >
            <VideoIcon />
            <p className="text-sm text-gray-500 dark:text-gray-400">Drop videos here or <span className="text-emerald-600 dark:text-emerald-400 font-medium">browse</span></p>
            <p className="text-xs text-gray-400 dark:text-gray-600">.mov</p>
            <input ref={videoInputRef} type="file" multiple accept=".mov,video/quicktime" className="hidden" onChange={(e) => setVideos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
          </div>

          {videos.length > 0 && (
            <ul className="mt-3 space-y-2">
              {videos.map((file, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-emerald-600 dark:text-emerald-400 shrink-0"><VideoIcon /></span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <button type="button" onClick={() => removeVideo(i)} className="ml-3 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                    <XIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Details</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={3} value={form.description} onChange={set("description")} placeholder="Describe the piece — quality, appearance, origin..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Blemishes</label>
            <textarea rows={2} value={form.blemishes} onChange={set("blemishes")} placeholder="Note any imperfections, inclusions, or marks..." className={inputClass} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Pricing</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Display Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input type="number" step="0.01" min="0" value={form.price_display_usd} onChange={set("price_display_usd")} placeholder="0.00" className={`${inputClass} pl-7`} />
            </div>
            <p className="mt-1 text-xs text-gray-400">Leave blank to show "Contact for price"</p>
          </div>
          <div>
            <label className={labelClass}>Imported Price (VND) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₫</span>
              <input required type="number" min="0" value={form.imported_price_vnd} onChange={set("imported_price_vnd")} placeholder="0" className={`${inputClass} pl-7`} />
            </div>
          </div>
        </div>
      </section>

      {/* Options */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Options</h2>
        <button
          type="button"
          onClick={() => setIsFeatured((v) => !v)}
          className="flex items-center gap-3 group"
        >
          <div className={`relative w-10 h-6 rounded-full transition-colors ${isFeatured ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isFeatured ? "translate-x-4" : ""}`} />
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
            Feature this product on the homepage
          </span>
        </button>
      </section>

      {/* Result */}
      {result?.success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Product added successfully.
        </div>
      )}
      {result?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {result.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "Uploading & saving…" : "Add Product"}
      </button>
    </form>
  );
}
