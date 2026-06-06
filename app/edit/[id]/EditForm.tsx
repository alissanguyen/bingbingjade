"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProduct, deleteProduct } from "./actions";
import { ImageCropModal, VideoTrimModal } from "@/app/add/MediaCroppers";
import type { Vendor } from "@/types/vendor";
import type { ProductCategory, OptionStatus } from "@/types/product";

interface OptionRow {
  label: string;
  size: string;
  price: string;
  salePrice: string;
  comboOf: number[];
  status: OptionStatus;
  imageIndex: number | null;
}

const CATEGORIES: ProductCategory[] = ["bracelet", "bangle", "ring", "pendant", "necklace", "set", "earring", "raw_material"];

const TIERS = ["Been", "Glutinous", "Fine Glutinous", "Very Fine Glutinous", "Icy Glutinous", "Icy", "High Icy", "Glassy", "Longshi"];

const COLORS: { value: string; label: string; swatch: string; border?: string }[] = [
  { value: "white", label: "White", swatch: "bg-white", border: "border-gray-300" },
  { value: "green", label: "Green", swatch: "bg-green-500" },
  { value: "blue", label: "Blue", swatch: "bg-blue-500" },
  { value: "red", label: "Red", swatch: "bg-red-500" },
  { value: "pink", label: "Pink", swatch: "bg-pink-400" },
  { value: "lavender", label: "Lavender", swatch: "bg-purple-300" },
  { value: "orange", label: "Orange", swatch: "bg-orange-500" },
  { value: "yellow", label: "Yellow", swatch: "bg-yellow-400" },
  { value: "black", label: "Black", swatch: "bg-gray-900" },
  { value: "marbling", label: "Marbling", swatch: "marbling-swatch", border: "border-emerald-200/80" },
];

const PLATFORM_COLORS: Record<string, string> = {
  zalo: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  facebook: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  wechat: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  tiktok: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  other: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

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

function VendorSearch({ vendors, initialId, onChange }: { vendors: Vendor[]; initialId: string; onChange: (id: string) => void }) {
  const initial = vendors.find((v) => v.id === initialId) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Vendor | null>(initial);
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

  const select = (v: Vendor) => { setSelected(v); onChange(v.id); setQuery(""); setOpen(false); };
  const clear = () => { setSelected(null); onChange(""); setQuery(""); };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-[12px] sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[selected.platform]}`}>{selected.platform}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selected.name}</span>
            <span className="text-xs text-gray-400 font-mono truncate hidden sm:block">{selected.id.slice(0, 8)}…</span>
          </div>
          <button type="button" onClick={clear} className="ml-2 shrink-0 text-gray-400 hover:text-red-500 transition-colors"><XIcon /></button>
        </div>
      ) : (
        <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search by name or ID…" className={inputClass} />
      )}
      {open && !selected && (
        <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No vendors found.</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => select(v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[v.platform]}`}>{v.platform}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{v.id}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface ProductData {
  id: string;
  name: string;
  category: ProductCategory;
  origin: string;
  images: string[];
  videos: string[];
  color: string[];
  tier: string[];
  size: number;
  size_detailed: (number | null)[] | null;
  description: string | null;
  blemishes: string | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  imported_price_vnd: number;
  show_price: boolean;
  vendor_id: string;
  is_featured: boolean;
  is_clearance: boolean;
  is_published: boolean;
  quick_ship: boolean;
  status: "available" | "sold" | "on_sale" | "archived";
  renewed_at: string | null;
}

interface InitialOption {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  sale_price_usd: number | null;
  comboOf?: number[] | null;
  status: OptionStatus;
  image_index: number | null;
}

interface Props {
  product: ProductData;
  vendors: Vendor[];
  initialOptions?: InitialOption[];
  isApprovedUser?: boolean;
  hasPendingApproval?: boolean;
  sku?: string | null;
}

export function EditForm({ product, vendors, initialOptions = [], isApprovedUser = false, hasPendingApproval = false, sku }: Props) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Two-queue image system ────────────────────────────────────────────────────
  type PendingItem =
    | { id: string; kind: "local"; file: File; preview: string | null; processing: "navy" | "beige" | null; error?: string | null }
    | { id: string; kind: "existing"; url: string; processing: "navy" | "beige" | null; error?: string | null };
  type AcceptedItem =
    | { id: string; kind: "existing"; url: string }
    | { id: string; kind: "new"; file: File; preview: string | null; broken?: boolean };

  const eNewId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Existing product images start in Accepted
  const [pendingImages, setPendingImages] = useState<PendingItem[]>([]);
  const [acceptedImages, setAcceptedImages] = useState<AcceptedItem[]>(
    (product.images ?? []).map((url) => ({ id: eNewId(), kind: "existing" as const, url }))
  );
  const acceptedDragRef = useRef<number | null>(null);
  const [acceptedDragOver, setAcceptedDragOver] = useState<number | null>(null);

  const [existingVideos, setExistingVideos] = useState<string[]>(product.videos ?? []);
  const [newVideos, setNewVideos] = useState<File[]>([]);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ index: number; src: string; fileName: string } | null>(null);
  const [pendingCropTarget, setPendingCropTarget] = useState<{ id: string; src: string; fileName: string } | null>(null);
  const [trimTarget, setTrimTarget] = useState<{ index: number; file: File } | null>(null);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const preview = URL.createObjectURL(file);
      setPendingImages((prev) => [...prev, { id: eNewId(), kind: "local", file, preview, processing: null }]);
    });
  };

  const moveToPending = (id: string) => {
    const item = acceptedImages.find((a) => a.id === id);
    if (!item) return;
    setAcceptedImages((prev) => prev.filter((a) => a.id !== id));
    if (item.kind === "existing") {
      setPendingImages((prev) => [...prev, { id: eNewId(), kind: "existing", url: item.url, processing: null }]);
    } else {
      setPendingImages((prev) => [...prev, { id: eNewId(), kind: "local", file: item.file, preview: item.preview, processing: null }]);
    }
  };

  const removeFromPending = (id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.kind === "local" && item.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const removeFromAccepted = (id: string) => {
    setAcceptedImages((prev) => {
      const removedIdx = prev.findIndex((a) => a.id === id);
      const item = prev[removedIdx];
      if (item?.kind === "new" && item.preview) URL.revokeObjectURL(item.preview);
      if (removedIdx >= 0) {
        setOptionRows((rows) => rows.map((row) => {
          if (row.imageIndex === null) return row;
          if (row.imageIndex === removedIdx) return { ...row, imageIndex: null };
          if (row.imageIndex > removedIdx) return { ...row, imageIndex: row.imageIndex - 1 };
          return row;
        }));
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const skipImage = (id: string) => {
    const item = pendingImages.find((p) => p.id === id);
    if (!item) return;
    if (item.kind === "existing") {
      setAcceptedImages((prev) => [...prev, { id: eNewId(), kind: "existing", url: item.url }]);
    } else {
      setAcceptedImages((prev) => [...prev, { id: eNewId(), kind: "new", file: item.file, preview: item.preview }]);
    }
  };

  async function processImageBg(id: string, mode: "navy" | "beige") {
    const item = pendingImages.find((p) => p.id === id);
    if (!item) return;
    setPendingImages((prev) => prev.map((p) => p.id === id ? { ...p, processing: mode, error: null } : p));
    try {
      let body: { imageBase64?: string; imageUrl?: string; backgroundMode: "navy" | "beige" };
      if (item.kind === "existing") {
        // Route fetches originals/ for existing wm/ images — no logo sent to OpenAI
        body = { imageUrl: item.url, backgroundMode: mode };
      } else {
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });
        body = { imageBase64, backgroundMode: mode };
      }
      const res = await fetch("/api/image/process-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { success: boolean; processedBase64?: string; error?: string };
      if (!json.success || !json.processedBase64) throw new Error(json.error ?? "Processing failed");
      const byteStr = atob(json.processedBase64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      const stem = (item.kind === "existing"
        ? (item.url.split("/").pop()?.split("?")[0] ?? "image")
        : item.file.name
      ).replace(/\.[^.]+$/, "");
      const processedFile = new File([blob], `${stem}_ai_${mode}.png`, { type: "image/png" });
      const preview = URL.createObjectURL(processedFile);
      setAcceptedImages((prev) => [...prev, { id: eNewId(), kind: "new", file: processedFile, preview }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      setPendingImages((prev) => prev.map((p) => p.id === id ? { ...p, error: msg } : p));
    } finally {
      setPendingImages((prev) => prev.map((p) => p.id === id ? { ...p, processing: null } : p));
    }
  }

  const handleCropConfirm = (croppedFile: File) => {
    if (!cropTarget) return;
    const preview = URL.createObjectURL(croppedFile);
    setAcceptedImages((prev) => {
      const updated = [...prev];
      const old = updated[cropTarget.index];
      if (old?.kind === "new" && old.preview) URL.revokeObjectURL(old.preview);
      updated[cropTarget.index] = { id: old?.id ?? eNewId(), kind: "new", file: croppedFile, preview };
      return updated;
    });
    setCropTarget(null);
  };

  const handlePendingCropConfirm = (croppedFile: File) => {
    if (!pendingCropTarget) return;
    const preview = URL.createObjectURL(croppedFile);
    setPendingImages((prev) => prev.map((p) => {
      if (p.id !== pendingCropTarget.id || p.kind !== "local") return p;
      if (p.preview) URL.revokeObjectURL(p.preview);
      return { ...p, file: croppedFile, preview };
    }));
    setPendingCropTarget(null);
  };

  const handleTrimConfirm = (trimmedFile: File) => {
    if (!trimTarget) return;
    setNewVideos((prev) => {
      const updated = [...prev];
      updated[trimTarget.index] = trimmedFile;
      return updated;
    });
    setTrimTarget(null);
  };

  const [imageDragging, setImageDragging] = useState(false);
  const [videoDragging, setVideoDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; pendingApproval?: boolean } | null>(null);
  const [renewedAt, setRenewedAt] = useState<string | null>(product.renewed_at ?? null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewMsg, setRenewMsg] = useState<string | null>(null);

  const [vendorId, setVendorId] = useState(product.vendor_id);
  const [selectedColors, setSelectedColors] = useState<string[]>(product.color ?? []);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(product.tier ?? []);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);
  const [isPublished, setIsPublished] = useState(product.is_published);
  const [isQuickShip, setIsQuickShip] = useState(product.quick_ship ?? false);
  const [isIsClearance, setIsIsClearance] = useState(product.is_clearance ?? false);
  const [showPrice, setShowPrice] = useState(product.show_price ?? true);
  const [status, setStatus] = useState<"available" | "sold" | "on_sale" | "archived">(product.status ?? "available");

  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    origin: product.origin,
    size: String(product.size),
    description: product.description ?? "",
    blemishes: product.blemishes ?? "",
    price_display_usd: product.price_display_usd != null ? String(product.price_display_usd) : "",
    sale_price_usd: product.sale_price_usd != null ? String(product.sale_price_usd) : "",
    imported_price_vnd: String(product.imported_price_vnd),
  });
  const [sizeDetailed, setSizeDetailed] = useState<[string, string, string]>([
    product.size_detailed?.[0] != null ? String(product.size_detailed[0]) : "",
    product.size_detailed?.[1] != null ? String(product.size_detailed[1]) : "",
    product.size_detailed?.[2] != null ? String(product.size_detailed[2]) : "",
  ]);
  const [priceHint, setPriceHint] = useState<string | null>(null);

  function suggestPrice() {
    const vnd = parseFloat(form.imported_price_vnd);
    if (!vnd || vnd <= 0) return;
    const costUsd = vnd / 26000;
    const multiplier = costUsd < 1000 ? 3.0 : costUsd < 3000 ? 2.7 : costUsd < 8000 ? 2.3 : 2.0;
    const raw = costUsd * multiplier;
    const suggested = raw < 2000
      ? Math.round(raw / 50) * 50
      : Math.round(raw / 100) * 100;
    setForm(prev => ({ ...prev, price_display_usd: String(suggested) }));
    setPriceHint(
      `Suggested from ₫${Number(vnd).toLocaleString()} import cost → $${costUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} cost • ${multiplier}× tier. You can edit this price manually.`
    );
  }

  const blankRow = (): OptionRow => ({
    label: "",
    size: "",
    price: "",
    salePrice: "",
    comboOf: [],
    status: "available",
    imageIndex: null,
  });
  // Has variants = more than one option, or single option with a label
  const [hasVariants, setHasVariants] = useState(
    initialOptions.some(
      (o) =>
        o.label ||
        o.size != null ||
        o.price_usd != null ||
        o.sale_price_usd != null
    )
  );
  const [optionRows, setOptionRows] = useState<OptionRow[]>(
    initialOptions.length > 0
      ? initialOptions.map((o) => ({
        label: o.label ?? "",
        size: o.size != null ? String(o.size) : "",
        price: o.price_usd != null ? String(o.price_usd) : "",
        salePrice: o.sale_price_usd != null ? String(o.sale_price_usd) : "",
        comboOf: o.comboOf ?? [],
        status: o.status,
        imageIndex: o.image_index ?? null,
      }))
      : [blankRow()]
  );

  const updateOptionRow = (i: number, field: keyof OptionRow, value: string) =>
    setOptionRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });

  const setVariantImageIndex = (rowIdx: number, imgIdx: number | null) =>
    setOptionRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], imageIndex: imgIdx };
      return next;
    });

  const addOptionRow = () =>
    setOptionRows((prev) => [...prev, blankRow()]);

  const removeOptionRow = (i: number) =>
    setOptionRows((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((row) => ({
          ...row,
          comboOf: row.comboOf
            .filter((idx) => idx !== i)
            .map((idx) => (idx > i ? idx - 1 : idx)),
        }))
    );

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleColor = (color: string) =>
    setSelectedColors((prev) => prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]);

  const removeExistingVideo = (i: number) => setExistingVideos((prev) => prev.filter((_, idx) => idx !== i));
  const removeNewVideo = (i: number) => setNewVideos((prev) => prev.filter((_, idx) => idx !== i));

  const uploadNewFiles = async () => {
    // Upload accepted images in order
    const orderedImageUrls: string[] = [];
    for (const item of acceptedImages) {
      if (item.kind === "existing") {
        orderedImageUrls.push(item.url);
      } else {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("category", form.category);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(`Image upload failed: ${error}`);
        }
        const { path } = await res.json();
        orderedImageUrls.push(path);
      }
    }

    // Pending images were not explicitly accepted but should still be saved to the listing.
    // Upload local files through /api/upload-image (applies watermark) so they land in
    // products.images. Existing-URL pending items already have a wm/ path — include as-is.
    for (const item of pendingImages) {
      if (item.kind === "local") {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("category", form.category);
        const res = await fetch("/api/upload-image", { method: "POST", body: fd });
        if (res.ok) {
          const { path } = await res.json();
          orderedImageUrls.push(path);
        }
      } else {
        // kind: "existing" — was pulled back to pending for reprocessing but not yet done
        orderedImageUrls.push(item.url);
      }
    }

    // Record originals for provenance tracking (separate from the listing save above)
    for (const item of pendingImages) {
      if (!sku) continue;
      if (item.kind === "local") {
        const fd = new FormData();
        fd.append("file", item.file);
        fd.append("sku", sku);
        if (vendorId) fd.append("vendor_id", vendorId);
        await fetch("/api/image/record-original", { method: "POST", body: fd })
          .catch((e) => console.warn("[record-original] local:", e));
      } else {
        await fetch("/api/image/record-original", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wmUrl: item.url, sku, vendor_id: vendorId || null }),
        }).catch((e) => console.warn("[record-original] existing:", e));
      }
    }

    // Videos
    const videoUrls: string[] = [];
    for (const file of newVideos) {
      const urlRes = await fetch("/api/create-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get video upload URL");
      const { signedUrl, path } = await urlRes.json();
      const uploadRes = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Video upload failed");
      videoUrls.push(path);
    }
    return { orderedImageUrls, videoUrls };
  };

  const handleRenew = async () => {
    setIsRenewing(true);
    setRenewMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/renew`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setRenewMsg(data.error ?? "Renew failed."); return; }
      setRenewedAt(data.renewed_at);
      setRenewMsg("Listing renewed — it will now appear first.");
    } finally {
      setIsRenewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasVariants && status === "sold" && optionRows.some((r) => r.status !== "sold")) {
      setResult({ error: "All variants must be marked as Sold before the product can be marked Sold." });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const { orderedImageUrls, videoUrls } = await uploadNewFiles();
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("vendor_id", vendorId);
      fd.append("is_featured", String(isFeatured));
      fd.append("is_published", String(isPublished));
      fd.append("quick_ship", String(isQuickShip));
      fd.append("is_clearance", String(isIsClearance));
      fd.append("show_price", String(showPrice));
      fd.append("status", status);
      sizeDetailed.forEach((v, i) => fd.append(`size_detailed_${i}`, v));
      selectedColors.forEach((c) => fd.append("color", c));
      selectedTiers.forEach((t) => fd.append("tier", t));
      orderedImageUrls.forEach((url) => fd.append("imageUrls", url));
      [...existingVideos, ...videoUrls].forEach((url) => fd.append("videoUrls", url));

      const rowsToSubmit = hasVariants ? optionRows : [{ ...blankRow(), status: status === "sold" ? "sold" as OptionStatus : "available" as OptionStatus }];
      const optionsForJson = rowsToSubmit.map((row) => ({
        label: row.label,
        size: row.size,
        price: row.price,
        salePrice: row.salePrice,
        comboOf: row.comboOf,
        status: row.status,
        image_index: row.imageIndex ?? null,
      }));
      fd.append("options_json", JSON.stringify(optionsForJson));

      const res = await updateProduct(product.id, fd);
      if (res.error) {
        setResult({ error: res.error });
      } else {
        setResult({ success: true, pendingApproval: res.pendingApproval });
        setNewVideos([]);
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const res = await deleteProduct(product.id);
    if (res.error) {
      setResult({ error: res.error });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      router.push("/edit");
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm sm:text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Pending approval notice */}
      {hasPendingApproval && !result?.success && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {isApprovedUser
            ? "This listing is awaiting admin approval. You can update your submission below."
            : "This listing has a pending edit from a partner awaiting your approval."}
        </div>
      )}

      {/* Basic Info */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Basic Info</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Product Name <span className="text-red-400">*</span></label>
            <input required value={form.name} onChange={set("name")} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category <span className="text-red-400">*</span></label>
              <select required value={form.category} onChange={set("category")} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Vendor <span className="text-red-400">*</span></label>
              <VendorSearch vendors={vendors} initialId={vendorId} onChange={setVendorId} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Origin</label>
            <select required value={form.origin} onChange={set("origin")} className={inputClass}>
              <option value="Myanmar">Myanmar</option>
              <option value="Guatemala">Guatemala</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Color <span className="text-red-400">*</span>
              {selectedColors.length > 0 && <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">{selectedColors.join(", ")}</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => {
                const active = selectedColors.includes(c.value);
                return (
                  <button key={c.value} type="button" onClick={() => toggleColor(c.value)}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm border transition-all ${active ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                    <span className={`w-3.5 h-3.5 rounded-full shrink-0 border ${c.swatch} ${c.border ?? "border-transparent"}`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
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
                    className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${active
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Size <span className="text-red-400">*</span></label>
              <input required type="number" step="0.1" value={form.size} onChange={set("size")} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>
              Detailed Dimensions
              <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">size × width × thickness (mm)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["Size", "Width", "Thickness"] as const).map((label, i) => (
                <input
                  key={i}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={label}
                  value={sizeDetailed[i]}
                  onChange={(e) => setSizeDetailed((prev) => { const next = [...prev] as [string, string, string]; next[i] = e.target.value; return next; })}
                  className={inputClass}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Media */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Media</h2>

        {/* Image Upload */}
        <div className="mb-6 space-y-4">
          <label className={labelClass}>Images</label>

          {/* ── Pending Process ────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
              Pending Process — originals preserved
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
              onDragLeave={() => setImageDragging(false)}
              onDrop={(e) => { e.preventDefault(); setImageDragging(false); addImages(e.dataTransfer.files); }}
              onClick={() => imageInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors ${
                imageDragging
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <UploadIcon />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-[12px]">Drop new images or <span className="text-amber-500 dark:text-amber-400 font-medium">browse</span></p>
              <input ref={imageInputRef} type="file" multiple accept=".heic,.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => addImages(e.target.files)} />
            </div>

            {pendingImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {pendingImages.map((item) => {
                  const preview = item.kind === "local" ? item.preview : item.url;
                  return (
                    <div key={item.id} className="relative group rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10 overflow-hidden">
                      <div className="relative aspect-square">
                        {preview ? (
                          <img src={preview} alt="pending" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl bg-gray-100 dark:bg-gray-800">📄</div>
                        )}
                        {item.processing && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-semibold animate-pulse">
                              {item.processing === "navy" ? "AI Navy…" : "AI Beige…"}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFromPending(item.id); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow text-xs"
                        >
                          <XIcon />
                        </button>
                        {item.kind === "local" && item.preview && !item.processing && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPendingCropTarget({ id: item.id, src: item.preview!, fileName: item.file.name }); }}
                            className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-emerald-600"
                            title="Crop"
                          >
                            <CropIcon />
                          </button>
                        )}
                      </div>
                      <div className="flex border-t border-amber-200 dark:border-amber-800">
                        {(["navy", "beige"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={item.processing != null}
                            onClick={() => processImageBg(item.id, mode)}
                            className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white disabled:opacity-40 transition-colors leading-none"
                            style={{ background: mode === "navy" ? "#061B35" : "#D4B896" }}
                          >
                            {item.processing === mode ? "…" : mode === "navy" ? "Navy" : "Beige"}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={item.processing != null}
                          onClick={() => skipImage(item.id)}
                          className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors leading-none"
                        >
                          Skip
                        </button>
                      </div>
                      {item.error && (
                        <p className="px-2 py-1 text-[10px] text-red-600 dark:text-red-400 leading-snug bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
                          {item.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Accepted ───────────────────────────────────────────── */}
          {acceptedImages.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                Accepted — saved to listing
              </p>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {acceptedImages.map((item, i) => {
                  const preview = item.kind === "existing" ? item.url : item.preview;
                  const broken = item.kind === "new" ? item.broken : false;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => { acceptedDragRef.current = i; }}
                      onDragOver={(e) => { e.preventDefault(); setAcceptedDragOver(i); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = acceptedDragRef.current;
                        if (from === null || from === i) { setAcceptedDragOver(null); return; }
                        const to = i;
                        setAcceptedImages((prev) => {
                          const next = [...prev];
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved);
                          return next;
                        });
                        setOptionRows((rows) => rows.map((row) => {
                          if (row.imageIndex === null) return row;
                          const idx = row.imageIndex;
                          if (idx === from) return { ...row, imageIndex: to };
                          if (from < to && idx > from && idx <= to) return { ...row, imageIndex: idx - 1 };
                          if (from > to && idx >= to && idx < from) return { ...row, imageIndex: idx + 1 };
                          return row;
                        }));
                        acceptedDragRef.current = null;
                        setAcceptedDragOver(null);
                      }}
                      onDragEnd={() => { acceptedDragRef.current = null; setAcceptedDragOver(null); }}
                      className={`relative group aspect-square cursor-grab active:cursor-grabbing rounded-lg transition-all ${
                        acceptedDragOver === i ? "ring-2 ring-emerald-500 scale-95" : ""
                      } ${i === 0 ? "ring-2 ring-emerald-400/60" : ""}`}
                    >
                      {i === 0 && (
                        <span className="absolute top-1 left-1 z-10 text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 rounded-sm leading-none">Cover</span>
                      )}
                      {preview && !broken ? (
                        <img
                          src={preview}
                          alt="accepted"
                          className="w-full h-full rounded-lg object-cover pointer-events-none"
                          onError={() => {
                            if (item.kind === "new") {
                              setAcceptedImages((prev) => prev.map((a) => a.id === item.id ? { ...a, broken: true } : a));
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">🪨</div>
                      )}
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFromAccepted(item.id); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow"
                      >
                        <XIcon />
                      </button>
                      {/* Crop (new images only) */}
                      {item.kind === "new" && preview && !broken && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCropTarget({ index: i, src: preview, fileName: item.file.name }); }}
                          className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-emerald-600"
                          title="Crop"
                        >
                          <CropIcon />
                        </button>
                      )}
                      {/* Re-process: move to pending */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moveToPending(item.id); }}
                        className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide bg-amber-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                        title="Move to Pending to re-process"
                      >
                        Re-process
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Existing videos */}
        {existingVideos.length > 0 && (
          <div className="mb-4">
            <p className={labelClass}>Current Videos</p>
            <ul className="space-y-2">
              {existingVideos.map((url, i) => (
                <li key={url} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <button type="button" onClick={() => setPreviewVideoUrl(previewVideoUrl === url ? null : url)}
                      className="flex items-center gap-2.5 min-w-0 text-left hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                      <span className="text-emerald-600 dark:text-emerald-400 shrink-0"><VideoIcon /></span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">{url.split("/").pop()?.split("?")[0]}</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0 font-medium">{previewVideoUrl === url ? "Hide" : "Play"}</span>
                    </button>
                    <button type="button" onClick={() => { removeExistingVideo(i); if (previewVideoUrl === url) setPreviewVideoUrl(null); }}
                      className="ml-3 text-gray-400 hover:text-red-500 transition-colors shrink-0"><XIcon /></button>
                  </div>
                  {previewVideoUrl === url && (
                    <video src={url} controls playsInline className="w-full max-h-72 bg-black" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add new videos */}
        <div>
          <label className={labelClass}>Add Videos (.mov, .mp4)</label>
          <div onDragOver={(e) => { e.preventDefault(); setVideoDragging(true); }} onDragLeave={() => setVideoDragging(false)}
            onDrop={(e) => { e.preventDefault(); setVideoDragging(false); const files = Array.from(e.dataTransfer.files).filter(f => /\.(mov|mp4)$/i.test(f.name)); setNewVideos(prev => [...prev, ...files]); }}
            onClick={() => videoInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors ${videoDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
            <VideoIcon />
            <p className="text-sm text-gray-500 dark:text-gray-400">Drop or <span className="text-emerald-600 dark:text-emerald-400 font-medium">browse</span></p>
            <input ref={videoInputRef} type="file" multiple accept=".mov,.mp4,video/quicktime,video/mp4" className="hidden" onChange={(e) => setNewVideos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
          </div>
          {newVideos.length > 0 && (
            <ul className="mt-3 space-y-2">
              {newVideos.map((file, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-emerald-600 dark:text-emerald-400 shrink-0"><VideoIcon /></span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button type="button" onClick={() => setTrimTarget({ index: i, file })} className="text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors" title="Trim video">
                      <ScissorsIcon />
                    </button>
                    <button type="button" onClick={() => removeNewVideo(i)} className="text-gray-400 hover:text-red-500 transition-colors"><XIcon /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Details</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={3} value={form.description} onChange={set("description")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Blemishes</label>
            <textarea rows={2} value={form.blemishes} onChange={set("blemishes")} className={inputClass} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Listing Price (USD) <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  required type="number" step="0.01" min="0"
                  value={form.price_display_usd}
                  onChange={e => { set("price_display_usd")(e); setPriceHint(null); }}
                  placeholder="0.00"
                  className={`${inputClass} pl-7`}
                />
              </div>
              {!isApprovedUser && (
                <button
                  type="button"
                  onClick={suggestPrice}
                  className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                >
                  Suggest Price
                </button>
              )}
            </div>
            {priceHint ? (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">{priceHint}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Always required. Control visibility with the toggle below.</p>
            )}
          </div>
          {!isApprovedUser && (
            <div className="sm:col-span-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPrice((v) => !v)}
                className="flex items-center gap-3 group"
              >
                <div className={`relative w-10 h-6 rounded-full transition-colors ${showPrice ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}>
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${showPrice ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                  {showPrice
                    ? "Price visible to customers"
                    : "Price hidden — customers see \"Contact for Price\""}
                </span>
              </button>
              <p className="mt-1.5 ml-[52px] text-xs text-gray-400">
                When hidden, the actual price is never sent to the browser.
              </p>
            </div>
          )}
          <div>
            <label className={labelClass}>Sale Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-amber-400">$</span>
              <input type="number" step="0.01" min="0" value={form.sale_price_usd} onChange={set("sale_price_usd")} placeholder="0.00" className={`${inputClass} pl-7 border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500`} />
            </div>
            <p className="mt-1 text-xs text-gray-400">Shown as the discounted price when status is On Sale</p>
          </div>
          {!isApprovedUser && (
            <div>
              <label className={labelClass}>Imported Price (VND) <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₫</span>
                <input required type="number" min="0" value={form.imported_price_vnd} onChange={set("imported_price_vnd")} className={`${inputClass} pl-7`} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Variants */}
      {/* Variants */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Variants
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Add separate sizes, prices, statuses, or photos for each option.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setHasVariants((v) => !v)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${hasVariants
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
          >
            {hasVariants ? "Variants On" : "Variants Off"}
          </button>
        </div>

        {hasVariants ? (
          <div className="space-y-4">
            {optionRows.map((row, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Variant {i + 1}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Each variant can have its own label, size, price, status, and image.
                    </p>
                  </div>

                  {optionRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOptionRow(i)}
                      className="shrink-0 rounded-full p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      aria-label={`Remove variant ${i + 1}`}
                    >
                      <XIcon />
                    </button>
                  )}
                </div>

                {/* Link to a product image (optional) */}
                {acceptedImages.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Link to image <span className="font-normal text-gray-400">(optional — jumps gallery to this image when variant is selected)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {acceptedImages.map((img, imgIdx) => {
                        const src = img.kind === "existing" ? img.url : (img.preview ?? undefined);
                        return (
                          <button
                            key={imgIdx}
                            type="button"
                            onClick={() => setVariantImageIndex(i, row.imageIndex === imgIdx ? null : imgIdx)}
                            className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${row.imageIndex === imgIdx ? "border-emerald-500" : "border-transparent opacity-60 hover:opacity-100"}`}
                          >
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">{imgIdx + 1}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {/* Variant fields */}
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Label
                        </label>
                        <input
                          value={row.label}
                          onChange={(e) => updateOptionRow(i, "label", e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 54mm / Style A"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Size
                        </label>
                        <input
                          value={row.size}
                          onChange={(e) => updateOptionRow(i, "size", e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 54.5"
                          type="number"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Price
                        </label>
                        <input
                          value={row.price}
                          onChange={(e) => updateOptionRow(i, "price", e.target.value)}
                          className={inputClass}
                          placeholder="USD"
                          type="number"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                          Sale Price
                        </label>
                        <input
                          value={row.salePrice}
                          onChange={(e) => updateOptionRow(i, "salePrice", e.target.value)}
                          className={inputClass}
                          placeholder="Optional"
                          type="number"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
                        Status
                      </span>

                      <button
                        type="button"
                        onClick={() => updateOptionRow(i, "status", "available")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${row.status === "available"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                      >
                        Available
                      </button>

                      <button
                        type="button"
                        onClick={() => updateOptionRow(i, "status", "sold")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${row.status === "sold"
                          ? "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                      >
                        Sold
                      </button>

                      <button
                        type="button"
                        onClick={() => updateOptionRow(i, "status", "on_sale")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${row.status === "on_sale"
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                      >
                        On Sale
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addOptionRow}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            >
              + Add Variant
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
            Variants are off. This product will use the main product size and pricing only.
          </div>
        )}
      </section>

      {/* Options */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-4 sm:px-6 sm:py-6">        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Options</h2>
        <div className="space-y-4">
          {/* Status */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</p>
            <div className="flex gap-2">
              {(["available", "on_sale", "sold", "archived"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${status === s
                    ? s === "available"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                      : s === "on_sale"
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                        : s === "sold"
                          ? "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          : "border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
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

          {/* Published — admin only; approved-user edits go to pending_data, publish state unchanged */}
          {!isApprovedUser && (
            <button type="button" onClick={() => setIsPublished((v) => !v)} className="flex items-center gap-3 group">
              <div className={`relative w-10 h-6 rounded-full transition-colors ${isPublished ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublished ? "translate-x-4" : ""}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {isPublished ? "Published — visible on storefront" : "Draft — hidden from storefront"}
              </span>
            </button>
          )}

          {/* Featured */}
          <button type="button" onClick={() => setIsFeatured((v) => !v)} className="flex items-center gap-3 group">
            <div className={`relative w-10 h-6 rounded-full transition-colors ${isFeatured ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isFeatured ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Feature this product on the homepage</span>
          </button>

          {/* Quick Ship */}
          <button type="button" onClick={() => setIsQuickShip((v) => !v)} className="flex items-center gap-3 group">
            <div className={`relative w-10 h-6 rounded-full transition-colors ${isQuickShip ? "bg-sky-500" : "bg-gray-200 dark:bg-gray-700"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isQuickShip ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
              {isQuickShip ? "Quick Ship — eligible for expedited shipping" : "Standard shipping timeline"}
            </span>
          </button>

          {/* Clearance */}
          <button type="button" onClick={() => setIsIsClearance((v) => !v)} className="flex items-center gap-3 group">
            <div className={`relative w-10 h-6 rounded-full transition-colors ${isIsClearance ? "bg-orange-500" : "bg-gray-200 dark:bg-gray-700"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isIsClearance ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
              {isIsClearance ? "Clearance — shown with clearance badge" : "Not clearance"}
            </span>
          </button>
        </div>
      </section>

      {result?.success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {result.pendingApproval
            ? "Changes submitted for admin approval. The live listing will update once reviewed."
            : "Product updated successfully."}
        </div>
      )}
      {result?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {result.error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.push("/products-admin")}
          className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Back
        </button>
        <button type="submit" disabled={isSubmitting}
          className="flex-1 rounded-full bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {isSubmitting ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Renew listing */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Renew Listing</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Move this listing to the top of &quot;Newest&quot; sort. Original listed date is preserved.
            </p>
            {renewedAt && (
              <p className="text-xs text-amber-500 mt-1">
                Last renewed {new Date(renewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRenew}
            disabled={isRenewing}
            className="shrink-0 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 transition-colors"
          >
            {isRenewing ? "Renewing…" : "Renew"}
          </button>
        </div>
        {renewMsg && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">{renewMsg}</p>
        )}
      </div>

      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors" onClick={() => setLightboxSrc(null)}>
            <XIcon />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxSrc} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {cropTarget && (
        <ImageCropModal
          src={cropTarget.src}
          fileName={cropTarget.fileName}
          onConfirm={handleCropConfirm}
          onClose={() => setCropTarget(null)}
        />
      )}

      {pendingCropTarget && (
        <ImageCropModal
          src={pendingCropTarget.src}
          fileName={pendingCropTarget.fileName}
          onConfirm={handlePendingCropConfirm}
          onClose={() => setPendingCropTarget(null)}
        />
      )}

      {trimTarget && (
        <VideoTrimModal
          file={trimTarget.file}
          onConfirm={handleTrimConfirm}
          onClose={() => setTrimTarget(null)}
        />
      )}

      {/* Delete */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
        {!showDeleteConfirm ? (
          <button type="button" onClick={() => setShowDeleteConfirm(true)}
            className="w-full rounded-full border border-red-200 dark:border-red-900 py-3 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-400 dark:hover:border-red-700 transition-colors">
            Delete Product
          </button>
        ) : (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Delete this product?</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-4">This cannot be undone. The product will be permanently removed from the database.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={isDeleting}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isDeleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
