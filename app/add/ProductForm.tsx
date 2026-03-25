"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createProduct } from "./actions";
import { createVendor } from "@/app/addvendor/actions";
import { ImageCropModal, VideoTrimModal } from "./MediaCroppers";
import type { Vendor, VendorPlatform } from "@/types/vendor";
import type { ProductCategory, OptionStatus } from "@/types/product";

interface OptionRow {
  label: string;
  size: string;
  price: string;
  status: OptionStatus;
  imageFile: File | null;
  imagePreview: string | null;
  existingImagePath: string;
  existingImageUrl: string;
}

interface Props {
  vendors: Vendor[];
}

const CATEGORIES: ProductCategory[] = ["bracelet", "bangle", "ring", "pendant", "necklace", "other", "custom_order"];

const TIERS = ["Been", "Glutinous", "Fine Glutinous", "Very Fine Glutinous", "Icy Glutinous", "Icy", "High Icy", "Glassy", "Longshi"];

const COLORS: { value: string; label: string; swatch: string; border?: string }[] = [
  { value: "white",    label: "White",    swatch: "bg-white",       border: "border-gray-300" },
  { value: "green",    label: "Green",    swatch: "bg-green-500" },
  { value: "blue",     label: "Blue",     swatch: "bg-blue-500" },
  { value: "red",      label: "Red",      swatch: "bg-red-500" },
  { value: "pink",     label: "Pink",     swatch: "bg-pink-400" },
  { value: "purple",   label: "Purple",   swatch: "bg-purple-500" },
  { value: "orange",   label: "Orange",   swatch: "bg-orange-500" },
  { value: "yellow",   label: "Yellow",   swatch: "bg-yellow-400" },
  { value: "black",    label: "Black",    swatch: "bg-gray-900" },
  { value: "marbling", label: "Marbling", swatch: "bg-gradient-to-br from-gray-200 via-white to-gray-400", border: "border-gray-300" },
];

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 3 6 18 21 18" /><polyline points="3 6 18 6 18 21" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
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

const PLATFORM_COLORS: Record<string, string> = {
  zalo: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  facebook: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  wechat: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  tiktok: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  other: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const ADD_PLATFORMS: { value: VendorPlatform; label: string }[] = [
  { value: "zalo",     label: "Zalo" },
  { value: "facebook", label: "Facebook" },
  { value: "wechat",   label: "WeChat" },
  { value: "tiktok",   label: "TikTok" },
  { value: "other",    label: "Other" },
];

function VendorSearch({ vendors: initialVendors, value, onChange }: { vendors: Vendor[]; value: string; onChange: (id: string) => void }) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", platform: "zalo" as VendorPlatform, contact: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = vendors.filter((v) => {
    const q = query.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q);
  });

  const select = (v: Vendor) => {
    setSelected(v);
    onChange(v.id);
    setQuery("");
    setOpen(false);
  };

  const clear = () => {
    setSelected(null);
    onChange("");
    setQuery("");
  };

  const handleAddVendor = async () => {
    if (!addForm.name.trim()) return;
    setAddLoading(true);
    setAddError(null);
    const fd = new FormData();
    fd.append("name", addForm.name.trim());
    fd.append("platform", addForm.platform);
    fd.append("contact", addForm.contact);
    const res = await createVendor(fd);
    setAddLoading(false);
    if (res.error) { setAddError(res.error); return; }
    const newVendor: Vendor = {
      id: res.id!,
      name: addForm.name.trim(),
      platform: addForm.platform,
      contact: addForm.contact || null,
      notes: null,
    };
    setVendors((prev) => [...prev, newVendor]);
    select(newVendor);
    setShowAddModal(false);
    setAddForm({ name: "", platform: "zalo", contact: "" });
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <>
      <div ref={ref} className="relative">
        {selected ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[selected.platform]}`}>
                {selected.platform}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selected.name}</span>
              <span className="text-xs text-gray-400 font-mono truncate hidden sm:block">{selected.id.slice(0, 8)}…</span>
            </div>
            <button type="button" onClick={clear} className="ml-2 shrink-0 text-gray-400 hover:text-red-500 transition-colors">
              <XIcon />
            </button>
          </div>
        ) : (
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name or ID…"
            className={inputClass}
          />
        )}

        {open && !selected && (
          <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
            {filtered.length > 0 && (
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => select(v)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[v.platform]}`}>
                        {v.platform}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{v.id}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">No vendors found.</p>
            )}
            <div className="border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => { setOpen(false); setShowAddModal(true); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add new vendor
              </button>
            </div>
          </div>
        )}
        <input type="hidden" name="vendor_id" value={value} required />
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Vendor</h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setAddError(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XIcon />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Minh Jade Supplier"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform</label>
                <div className="flex flex-wrap gap-2">
                  {ADD_PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, platform: p.value }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        addForm.platform === p.value
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact</label>
                <input
                  value={addForm.contact}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="Phone, username, or link"
                  className={inputClass}
                />
              </div>
              {addError && (
                <p className="text-xs text-red-500">{addError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setAddError(null); }}
                className="px-4 py-2 rounded-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddVendor}
                disabled={addLoading || !addForm.name.trim()}
                className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              >
                {addLoading ? "Saving…" : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
  const [isPublished, setIsPublished] = useState(false);
  const [status, setStatus] = useState<"available" | "sold" | "on_sale">("available");

  const [cropTarget, setCropTarget] = useState<{ index: number; src: string; fileName: string } | null>(null);
  const [trimTarget, setTrimTarget] = useState<{ index: number; file: File } | null>(null);
  const [variantCropTarget, setVariantCropTarget] = useState<{ index: number; src: string; fileName: string } | null>(null);

  // AI copy generation — local state only, not saved to DB
  const [sourceNotes, setSourceNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fillNotesFromForm = () => {
    const parts: string[] = [];
    if (form.category) parts.push(`Category: ${form.category}`);
    if (selectedColors.length > 0) parts.push(`Colors: ${selectedColors.join(", ")}`);
    if (selectedTiers.length > 0) parts.push(`Tier: ${selectedTiers.join(", ")}`);
    if (form.size) parts.push(`Size: ${form.size}mm`);
    if (sizeDetailed.some(Boolean)) {
      const labels = ["size", "width", "thickness"];
      parts.push(`Dimensions: ${sizeDetailed.map((v, i) => v ? `${labels[i]} ${v}mm` : "").filter(Boolean).join(", ")}`);
    }
    if (form.origin) parts.push(`Origin: ${form.origin}`);
    if (form.imported_price_vnd) parts.push(`Imported price: ${form.imported_price_vnd} VND`);
    setSourceNotes(parts.join("\n"));
  };

  // Resize an image File to max 1024px and return base64 JPEG string.
  // Used only for AI analysis — does not affect the actual upload quality.
  // Returns null if the browser cannot decode the file (e.g. HEIC on non-Safari).
  const resizeImageForAI = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        // Split off the "data:image/jpeg;base64," prefix
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });

  const generateCopy = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      // Encode up to 3 images for Claude vision (resize to 1024px — AI-only, upload is unaffected)
      const imagePayloads: { data: string; mediaType: "image/jpeg" }[] = [];
      for (const img of images.slice(0, 3)) {
        const b64 = await resizeImageForAI(img.file);
        if (b64) imagePayloads.push({ data: b64, mediaType: "image/jpeg" });
      }

      const res = await fetch("/api/generate-product-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          colors: selectedColors,
          tiers: selectedTiers,
          size: form.size,
          origin: form.origin,
          sourceNotes,
          images: imagePayloads,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error ?? "Generation failed");
        return;
      }
      setForm((f) => ({
        ...f,
        name: data.title ?? f.name,
        description: data.description ?? f.description,
        blemishes: data.blemishes ?? f.blemishes,
        size: data.size != null ? String(data.size) : f.size,
        origin: data.origin ?? f.origin,
        imported_price_vnd: data.imported_price_vnd != null ? String(data.imported_price_vnd) : f.imported_price_vnd,
      }));
      // Apply size_detailed if Claude returned width or thickness
      if (data.size != null || data.width != null || data.thickness != null) {
        setSizeDetailed((prev) => [
          data.size != null ? String(data.size) : prev[0],
          data.width != null ? String(data.width) : prev[1],
          data.thickness != null ? String(data.thickness) : prev[2],
        ]);
      }
    } catch {
      setGenerateError("Network error — could not reach generation endpoint");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariantCropConfirm = (croppedFile: File) => {
    if (!variantCropTarget) return;
    const preview = URL.createObjectURL(croppedFile);
    setVariantImage(variantCropTarget.index, croppedFile, preview);
    setVariantCropTarget(null);
  };

  const handleCropConfirm = (croppedFile: File) => {
    if (!cropTarget) return;
    const preview = URL.createObjectURL(croppedFile);
    setImages((prev) => {
      const updated = [...prev];
      const old = updated[cropTarget.index];
      if (old.preview) URL.revokeObjectURL(old.preview);
      updated[cropTarget.index] = { file: croppedFile, preview };
      return updated;
    });
    setCropTarget(null);
  };

  const handleTrimConfirm = (trimmedFile: File) => {
    if (!trimTarget) return;
    setVideos((prev) => {
      const updated = [...prev];
      updated[trimTarget.index] = trimmedFile;
      return updated;
    });
    setTrimTarget(null);
  };

  const [vendorId, setVendorId] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    category: "other" as ProductCategory,
    origin: "Myanmar",
    size: "",
    description: "",
    blemishes: "",
    price_display_usd: "",
    sale_price_usd: "",
    imported_price_vnd: "",
  });
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [sizeDetailed, setSizeDetailed] = useState<[string, string, string]>(["", "", ""]);

  const blankRow = (): OptionRow => ({ label: "", size: "", price: "", status: "available", imageFile: null, imagePreview: null, existingImagePath: "", existingImageUrl: "" });

  const [hasVariants, setHasVariants] = useState(false);
  const [optionRows, setOptionRows] = useState<OptionRow[]>([blankRow()]);

  const updateOptionRow = (i: number, field: keyof OptionRow, value: string) =>
    setOptionRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });

  const setVariantImage = (i: number, file: File, preview: string | null) =>
    setOptionRows((prev) => {
      const next = [...prev];
      if (next[i].imagePreview) URL.revokeObjectURL(next[i].imagePreview!);
      next[i] = { ...next[i], imageFile: file, imagePreview: preview };
      return next;
    });

  const clearVariantImage = (i: number) =>
    setOptionRows((prev) => {
      const next = [...prev];
      if (next[i].imagePreview) URL.revokeObjectURL(next[i].imagePreview!);
      next[i] = { ...next[i], imageFile: null, imagePreview: null, existingImagePath: "", existingImageUrl: "" };
      return next;
    });

  const addOptionRow = () =>
    setOptionRows((prev) => [...prev, blankRow()]);

  const removeOptionRow = (i: number) =>
    setOptionRows((prev) => {
      if (prev[i].imagePreview) URL.revokeObjectURL(prev[i].imagePreview!);
      return prev.filter((_, idx) => idx !== i);
    });

  const toggleColor = (color: string) =>
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const isHeic = file.name.toLowerCase().endsWith(".heic");
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const preview = (isHeic || isPdf) ? null : URL.createObjectURL(file);
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
    // Images — routed through /api/upload-image which applies watermark and
    // stores in the private jade-images bucket. Returns a storage path.
    const imageUrls: string[] = [];
    for (const { file } of images) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", form.category);
      const res = await fetch("/api/upload-image", { method: "POST", body: fd });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(`Image upload failed: ${error}`);
      }
      const { path } = await res.json();
      imageUrls.push(path);
    }

    // Videos — use a Supabase signed upload URL so large files don't pass
    // through the Next.js server. Returns a storage path.
    const videoUrls: string[] = [];
    for (const file of videos) {
      const urlRes = await fetch("/api/create-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get video upload URL");
      const { signedUrl, path } = await urlRes.json();

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      videoUrls.push(path);
    }

    return { imageUrls, videoUrls };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setResult({ error: "Please select a vendor before saving." });
      return;
    }
    if (hasVariants && status === "sold" && optionRows.some((r) => r.status !== "sold")) {
      setResult({ error: "All variants must be marked as Sold before the product can be marked Sold." });
      return;
    }
    setIsSubmitting(true);
    setResult(null);

    try {
      const { imageUrls, videoUrls } = await uploadFiles();

      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("vendor_id", vendorId);
      selectedColors.forEach((c) => fd.append("color", c));
      selectedTiers.forEach((t) => fd.append("tier", t));
      fd.append("is_featured", String(isFeatured));
      fd.append("is_published", String(isPublished));
      fd.append("status", status);
      sizeDetailed.forEach((v, i) => fd.append(`size_detailed_${i}`, v));
      imageUrls.forEach((url) => fd.append("imageUrls", url));
      videoUrls.forEach((url) => fd.append("videoUrls", url));

      // Upload variant images (skip if no variants)
      const rowsToSubmit = hasVariants ? optionRows : [{ ...blankRow(), status: status === "sold" ? "sold" as OptionStatus : "available" as OptionStatus }];
      const optionImagePaths: string[] = [];
      for (const row of rowsToSubmit) {
        if (row.imageFile) {
          const vfd = new FormData();
          vfd.append("file", row.imageFile);
          vfd.append("category", form.category);
          const res = await fetch("/api/upload-image", { method: "POST", body: vfd });
          if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(`Variant image upload failed: ${error}`);
          }
          const { path } = await res.json();
          optionImagePaths.push(path);
        } else {
          optionImagePaths.push(row.existingImagePath);
        }
      }
      const optionsForJson = rowsToSubmit.map((row, i) => ({
        label: row.label,
        size: row.size,
        price: row.price,
        status: row.status,
        images: optionImagePaths[i] ? [optionImagePaths[i]] : [],
      }));
      fd.append("options_json", JSON.stringify(optionsForJson));

      const res = await createProduct(fd);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true });
        setSelectedTiers([]);
        setForm({ name: "", category: "other", origin: "Myanmar", size: "", description: "", blemishes: "", price_display_usd: "", sale_price_usd: "", imported_price_vnd: "" });
        setVendorId("");
        setSelectedColors([]);
        setImages([]);
        setVideos([]);
        setIsFeatured(false);
        setSizeDetailed(["", "", ""]);
        setOptionRows([blankRow()]);
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
              {vendors.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No vendors yet — <a href="/addvendor" className="text-emerald-600 dark:text-emerald-400 underline">add one first</a>.</p>
              ) : (
                <VendorSearch vendors={vendors} value={vendorId} onChange={(id) => setVendorId(id)} />
              )}
            </div>
          </div>
          <div>
            <label className={labelClass}>Origin</label>
            <select required value={form.origin} onChange={set("origin")} className={inputClass}>
              <option value="Myanmar">Myanmar</option>
              <option value="Guatemala">Guatemala</option>
              <option value="Hetian">Hetian</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Color <span className="text-red-400">*</span>
              {selectedColors.length > 0 && (
                <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
                  {selectedColors.join(", ")}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => {
                const active = selectedColors.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleColor(c.value)}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm border transition-all ${
                      active
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full shrink-0 border ${c.swatch} ${c.border ?? "border-transparent"}`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            {selectedColors.length === 0 && (
              <p className="mt-1.5 text-xs text-red-400">Select at least one color.</p>
            )}
          </div>
          <div>
            <label className={labelClass}>
              Tier
              {selectedTiers.length > 0 && (
                <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">{selectedTiers.join(", ")}</span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => {
                const active = selectedTiers.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTiers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                    className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                      active
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelClass}>Size <span className="text-red-400">*</span></label>
            <input required type="number" step="0.1" value={form.size} onChange={set("size")} placeholder="e.g. 54" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>
              Detailed Dimensions
              <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">size × width × thickness (mm)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["Size", "Width", "Thickness"] as const).map((label, i) => (
                <div key={i} className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={label}
                    value={sizeDetailed[i]}
                    onChange={(e) => setSizeDetailed((prev) => { const next = [...prev] as [string,string,string]; next[i] = e.target.value; return next; })}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Media */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Media</h2>

        {/* Image Upload */}
        <div className="mb-6">
          <label className={labelClass}>Images (.heic, .jpg, .jpeg, .png, .pdf)</label>
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
            <p className="text-xs text-gray-400 dark:text-gray-600">.heic · .jpg · .jpeg · .png · .pdf</p>
            <input ref={imageInputRef} type="file" multiple accept=".heic,.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => addImages(e.target.files)} />
          </div>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map(({ file, preview }, i) => (
                <div key={i} className="relative group aspect-square">
                  {preview ? (
                    <img src={preview} alt={file.name} className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-1 p-1">
                      <span className="text-lg">{file.name.toLowerCase().endsWith(".pdf") ? "📄" : "🪨"}</span>
                      <span className="text-[10px] text-gray-400 truncate w-full text-center">
                        {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "HEIC"}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  >
                    <XIcon />
                  </button>
                  {preview && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCropTarget({ index: i, src: preview, fileName: file.name }); }}
                      className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-600"
                      title="Crop image"
                    >
                      <CropIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Video Upload */}
        <div>
          <label className={labelClass}>Videos (.mov, .mp4)</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setVideoDragging(true); }}
            onDragLeave={() => setVideoDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setVideoDragging(false);
              const files = Array.from(e.dataTransfer.files).filter(f => /\.(mov|mp4)$/i.test(f.name));
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
            <p className="text-xs text-gray-400 dark:text-gray-600">.mov · .mp4</p>
            <input ref={videoInputRef} type="file" multiple accept=".mov,.mp4,video/quicktime,video/mp4" className="hidden" onChange={(e) => setVideos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
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
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTrimTarget({ index: i, file })}
                      className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                      title="Trim video"
                    >
                      <ScissorsIcon />
                    </button>
                    <button type="button" onClick={() => removeVideo(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <XIcon />
                    </button>
                  </div>
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

          {/* AI Copy Generation */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                AI Copy Generation
              </p>
              <button
                type="button"
                onClick={generateCopy}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-medium text-white transition-colors"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Generate Copy
                  </>
                )}
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Source / vendor notes <span className="font-normal text-gray-400">(Vietnamese or English)</span>
                </label>
                <button
                  type="button"
                  onClick={fillNotesFromForm}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Fill from form ↓
                </button>
              </div>
              <textarea
                rows={3}
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                placeholder="e.g. hoàn hảo cao, không sớ rạn, màu xanh ngọc đậm, size 54mm, giá nhập 5 triệu…"
                className={`${inputClass} text-xs`}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Analyzes photos + notes to fill Name, Description, Blemishes, Size, Origin, and Imported Price. Review before saving.
            </p>
            {generateError && (
              <p className="text-xs text-red-500 dark:text-red-400">{generateError}</p>
            )}
          </div>

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
            <p className="mt-1 text-xs text-gray-400">Leave blank to show &quot;Contact for price&quot;</p>
          </div>
          {status === "on_sale" && (
          <div>
            <label className={labelClass}>Sale Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-amber-400">$</span>
              <input type="number" step="0.01" min="0" value={form.sale_price_usd} onChange={set("sale_price_usd")} placeholder="0.00" className={`${inputClass} pl-7 border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500`} />
            </div>
            <p className="mt-1 text-xs text-gray-400">Shown as the discounted price</p>
          </div>
          )}
          <div>
            <label className={labelClass}>Imported Price (VND) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₫</span>
              <input required type="number" min="0" value={form.imported_price_vnd} onChange={set("imported_price_vnd")} placeholder="0" className={`${inputClass} pl-7`} />
            </div>
          </div>
        </div>
      </section>

      {/* Variants */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Variants</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-gray-400 dark:text-gray-500">This product has variants</span>
            <button
              type="button"
              onClick={() => setHasVariants((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hasVariants ? "bg-emerald-600" : "bg-gray-300 dark:bg-gray-700"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hasVariants ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
        {!hasVariants && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Single one-of-a-kind piece. Enable variants if this product comes in multiple sizes or styles.</p>
        )}
        {hasVariants && (<>
        <div className="space-y-2">
          {optionRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-end rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
              {/* Variant image thumbnail */}
              <div className="shrink-0">
                <label className="block text-xs text-gray-400 mb-1">Photo</label>
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer group">
                  <input
                    type="file"
                    accept=".heic,.jpg,.jpeg,image/jpeg"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.name.toLowerCase().endsWith(".heic")) {
                        setVariantImage(i, file, null);
                      } else {
                        const src = URL.createObjectURL(file);
                        setVariantCropTarget({ index: i, src, fileName: file.name });
                      }
                      e.target.value = "";
                    }}
                  />
                  {(row.imagePreview || row.existingImageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imagePreview || row.existingImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </div>
                  )}
                  {(row.imageFile || row.existingImagePath) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearVariantImage(i); }}
                      className="absolute top-0 right-0 z-20 w-4 h-4 rounded-bl bg-red-500 text-white flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Label</label>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateOptionRow(i, "label", e.target.value)}
                    placeholder="e.g. Ring A, 51–52mm"
                    className={`${inputClass} text-xs py-2`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Size (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={row.size}
                    onChange={(e) => updateOptionRow(i, "size", e.target.value)}
                    placeholder="inherit"
                    className={`${inputClass} text-xs py-2`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateOptionRow(i, "price", e.target.value)}
                    placeholder="inherit"
                    className={`${inputClass} text-xs py-2`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                <button
                  type="button"
                  onClick={() => updateOptionRow(i, "status", "available")}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    row.status === "available"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  Avail
                </button>
                <button
                  type="button"
                  onClick={() => updateOptionRow(i, "status", "sold")}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    row.status === "sold"
                      ? "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  Sold
                </button>
                {optionRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOptionRow(i)}
                    className="ml-1 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOptionRow}
          className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add variant
        </button>
        </>)}
      </section>

      {/* Options */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Options</h2>
        <div className="space-y-4">
          {/* Status */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</p>
            <div className="flex gap-2">
              {(["available", "on_sale", "sold"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    status === s
                      ? s === "available"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                        : s === "on_sale"
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                        : "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {s === "on_sale" ? "On Sale" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {hasVariants && status === "sold" && optionRows.some((r) => r.status !== "sold") && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                {optionRows.filter((r) => r.status !== "sold").length} variant(s) still marked as available — mark all variants Sold first.
              </p>
            )}
          </div>

          {/* Published */}
          <button
            type="button"
            onClick={() => setIsPublished((v) => !v)}
            className="flex items-center gap-3 group"
          >
            <div className={`relative w-10 h-6 rounded-full transition-colors ${isPublished ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublished ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
              {isPublished ? "Published — visible on storefront" : "Draft — hidden from storefront"}
            </span>
          </button>

          {/* Featured */}
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
        </div>
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

      {cropTarget && (
        <ImageCropModal
          src={cropTarget.src}
          fileName={cropTarget.fileName}
          onConfirm={handleCropConfirm}
          onClose={() => setCropTarget(null)}
        />
      )}

      {variantCropTarget && (
        <ImageCropModal
          src={variantCropTarget.src}
          fileName={variantCropTarget.fileName}
          onConfirm={handleVariantCropConfirm}
          onClose={() => setVariantCropTarget(null)}
        />
      )}

      {trimTarget && (
        <VideoTrimModal
          file={trimTarget.file}
          onConfirm={handleTrimConfirm}
          onClose={() => setTrimTarget(null)}
        />
      )}
    </form>
  );
}
