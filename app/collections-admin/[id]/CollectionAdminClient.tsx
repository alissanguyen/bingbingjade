"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { productThumbUrl } from "@/lib/storage";

/* ── Types ──────────────────────────────────────────────────────────── */

interface TagProduct {
  id: string; name: string; slug: string;
  images: string[]; price_display_usd: number | null;
  sale_price_usd: number | null; show_price: boolean; status: string;
}
interface SceneTag {
  id: string; x: number; y: number;
  mobile_x: number | null; mobile_y: number | null;
  products: TagProduct;
}
interface Scene {
  id: string; image: string; imageUrl: string;
  mobile_image: string | null; mobileImageUrl: string | null;
  caption: string | null; sort_order: number;
  collection_scene_tags: SceneTag[];
}
interface CollectionProduct {
  id: string; sort_order: number;
  products: { id: string; name: string; slug: string; public_id: string; category: string; images: string[]; price_display_usd: number | null; status: string };
}
interface Collection {
  id: string; name: string; slug: string; subtitle: string | null;
  description: string | null; hero_image: string | null;
  status: string; sort_order: number;
  collection_scenes: Scene[];
  collection_products: CollectionProduct[];
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
      />
    </div>
  );
}

function Textarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
      />
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">{title}</h2>
      {children}
    </div>
  );
}

/* ── Scene Tag Editor ────────────────────────────────────────────────── */

function SceneTagEditor({
  scene, collectionId, onTagAdded, onTagRemoved,
}: {
  scene: Scene;
  collectionId: string;
  onTagAdded: (sceneId: string, tag: SceneTag) => void;
  onTagRemoved: (sceneId: string, tagId: string) => void;
}) {
  const [tags, setTags] = useState<SceneTag[]>(scene.collection_scene_tags);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TagProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragPos, setDragPos] = useState<{ tagId: string; x: number; y: number } | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ tagId: string; hasMoved: boolean } | null>(null);
  const suppressNextClick = useRef(false);

  // ── Coordinate helpers ──────────────────────────────────────────────

  function getTagDisplayX(tag: SceneTag): number {
    if (dragPos?.tagId === tag.id) return dragPos.x;
    return view === "mobile" ? (tag.mobile_x ?? tag.x) : tag.x;
  }

  function getTagDisplayY(tag: SceneTag): number {
    if (dragPos?.tagId === tag.id) return dragPos.y;
    return view === "mobile" ? (tag.mobile_y ?? tag.y) : tag.y;
  }

  function clampedCoords(e: React.PointerEvent): { x: number; y: number } {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  // ── Drag handlers ───────────────────────────────────────────────────

  function handleTagPointerDown(e: React.PointerEvent, tagId: string) {
    e.stopPropagation();
    if (!imgRef.current) return;
    imgRef.current.setPointerCapture(e.pointerId);
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    dragStateRef.current = { tagId, hasMoved: false };
    setDragPos({ tagId, x: getTagDisplayX(tag), y: getTagDisplayY(tag) });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStateRef.current) return;
    const { x, y } = clampedCoords(e);
    dragStateRef.current.hasMoved = true;
    setDragPos({ tagId: dragStateRef.current.tagId, x, y });
  }

  async function handlePointerUp(e: React.PointerEvent) {
    if (!dragStateRef.current) return;
    const { tagId, hasMoved } = dragStateRef.current;
    dragStateRef.current = null;
    const pos = dragPos;
    setDragPos(null);

    if (!hasMoved || !pos) return;
    suppressNextClick.current = true;

    const isMobileView = view === "mobile";
    setTags((prev) => prev.map((t) => {
      if (t.id !== tagId) return t;
      return isMobileView
        ? { ...t, mobile_x: pos.x, mobile_y: pos.y }
        : { ...t, x: pos.x, y: pos.y };
    }));

    const body = isMobileView
      ? { tagId, mobile_x: pos.x, mobile_y: pos.y }
      : { tagId, x: pos.x, y: pos.y };

    await fetch(
      `/api/admin/collections/${collectionId}/scenes/${scene.id}/tags`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
  }

  // ── Click-to-place (desktop only) ───────────────────────────────────

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressNextClick.current) { suppressNextClick.current = false; return; }
    if (view === "mobile") return;
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x, y });
    setSearch("");
    setResults([]);
  }

  // ── Product search ──────────────────────────────────────────────────

  const runSearch = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setResults(json.results ?? []);
      } finally { setSearching(false); }
    }, 250);
  }, []);

  async function addTag(product: TagProduct) {
    if (!pending) return;
    const res = await fetch(
      `/api/admin/collections/${collectionId}/scenes/${scene.id}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, x: pending.x, y: pending.y }),
      }
    );
    if (!res.ok) return;
    const raw = await res.json();
    const tag: SceneTag = {
      id: raw.id,
      x: raw.x,
      y: raw.y,
      mobile_x: raw.mobile_x ?? null,
      mobile_y: raw.mobile_y ?? null,
      products: Array.isArray(raw.products) ? raw.products[0] : raw.products,
    };
    setTags((prev) => [...prev, tag]);
    onTagAdded(scene.id, tag);
    setPending(null);
    setSearch("");
    setResults([]);
  }

  async function removeTag(tagId: string) {
    const res = await fetch(
      `/api/admin/collections/${collectionId}/scenes/${scene.id}/tags`,
      { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId }) }
    );
    if (!res.ok) return;
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    onTagRemoved(scene.id, tagId);
  }

  async function clearMobileOverride(tagId: string) {
    setTags((prev) => prev.map((t) => t.id !== tagId ? t : { ...t, mobile_x: null, mobile_y: null }));
    await fetch(
      `/api/admin/collections/${collectionId}/scenes/${scene.id}/tags`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId, mobile_x: null, mobile_y: null }) }
    );
  }

  // ── Image to display based on view ─────────────────────────────────

  const imageUrl = view === "mobile" && scene.mobileImageUrl ? scene.mobileImageUrl : scene.imageUrl;

  return (
    <div className="space-y-3">

      {/* View toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setView("desktop"); setPending(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "desktop" ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
        >
          Desktop
        </button>
        <button
          type="button"
          onClick={() => { setView("mobile"); setPending(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === "mobile" ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
        >
          Mobile
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          {view === "desktop"
            ? "Click image to place tag. Drag dots to reposition."
            : "Drag dots to set mobile position overrides."}
        </p>
      </div>

      {/* Canvas wrapper — narrowed for mobile preview */}
      <div className={view === "mobile" ? "max-w-[320px] mx-auto" : "w-full"}>
        {view === "mobile" && (
          <div className="mb-1 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Mobile preview
          </div>
        )}
        <div
          ref={imgRef}
          className={`relative cursor-crosshair overflow-hidden border border-gray-200 dark:border-gray-700 select-none ${view === "mobile" ? "rounded-2xl shadow-xl ring-4 ring-gray-200 dark:ring-gray-600" : "rounded-lg"}`}
          onClick={handleImageClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <Image src={imageUrl} alt="" width={1400} height={900} className="w-full h-auto" unoptimized />

          {/* Tag dots */}
          {tags.map((tag, i) => (
            <div
              key={tag.id}
              className={`absolute flex items-center justify-center w-7 h-7 rounded-full border-2 border-white text-white text-[10px] font-bold shadow-lg touch-none ${
                dragPos?.tagId === tag.id
                  ? "cursor-grabbing bg-emerald-400 scale-110"
                  : "cursor-grab bg-emerald-500 hover:bg-emerald-400"
              } transition-colors`}
              style={{
                left: `${getTagDisplayX(tag)}%`,
                top: `${getTagDisplayY(tag)}%`,
                transform: "translate(-50%, -50%)",
                zIndex: dragPos?.tagId === tag.id ? 10 : 1,
              }}
              onPointerDown={(e) => handleTagPointerDown(e, tag.id)}
              onClick={(e) => e.stopPropagation()}
              title={tag.products.name}
            >
              {i + 1}
            </div>
          ))}

          {/* Pending placement indicator */}
          {pending && view === "desktop" && (
            <div
              className="absolute w-5 h-5 rounded-full border-2 border-emerald-400 bg-white/80 animate-pulse pointer-events-none"
              style={{ left: `${pending.x}%`, top: `${pending.y}%`, transform: "translate(-50%, -50%)" }}
            />
          )}
        </div>
      </div>

      {/* Product search (desktop view, pending placement) */}
      {pending && view === "desktop" && (
        <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Tag at ({pending.x.toFixed(0)}%, {pending.y.toFixed(0)}%) — search for a product:
          </p>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); runSearch(e.target.value); }}
            placeholder="Search products…"
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searching && <p className="text-xs text-gray-400">Searching…</p>}
          {results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addTag(p)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                >
                  {p.images?.[0] && (
                    <Image src={productThumbUrl(p.images[0])} alt="" width={32} height={32} className="rounded object-cover shrink-0" unoptimized />
                  )}
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setPending(null); setSearch(""); setResults([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tags list */}
      {tags.length > 0 && (
        <div className="space-y-1">
          {tags.map((tag, i) => {
            const hasMobileOverride = tag.mobile_x != null || tag.mobile_y != null;
            return (
              <div key={tag.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {tag.products.images?.[0] && (
                  <Image src={productThumbUrl(tag.products.images[0])} alt="" width={28} height={28} className="rounded object-cover shrink-0" unoptimized />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{tag.products.name}</span>
                <span className="text-[11px] font-mono text-gray-400 shrink-0">
                  {tag.x.toFixed(0)}%,{tag.y.toFixed(0)}%
                  {hasMobileOverride && (
                    <span className="text-blue-400 ml-1">
                      → {(tag.mobile_x ?? tag.x).toFixed(0)}%,{(tag.mobile_y ?? tag.y).toFixed(0)}%
                    </span>
                  )}
                </span>
                {hasMobileOverride && (
                  <button
                    type="button"
                    onClick={() => clearMobileOverride(tag.id)}
                    className="text-[11px] text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors shrink-0"
                    title="Clear mobile position override"
                  >
                    Reset mobile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="text-[11px] text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tags.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
          No tags yet — click on the image above to place one.
        </p>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */

export function CollectionAdminClient({ collection: initial }: { collection: Collection }) {
  const [collection, setCollection] = useState(initial);
  const [infoForm, setInfoForm] = useState({
    name: initial.name,
    slug: initial.slug,
    subtitle: initial.subtitle ?? "",
    description: initial.description ?? "",
    status: initial.status,
    sort_order: String(initial.sort_order),
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [uploadingScene, setUploadingScene] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [expandedTagger, setExpandedTagger] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<CollectionProduct["products"][]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const productDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Info save ─────────────────────────────── */

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setInfoError(null);
    try {
      const res = await fetch(`/api/admin/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: infoForm.name,
          slug: infoForm.slug,
          subtitle: infoForm.subtitle || null,
          description: infoForm.description || null,
          status: infoForm.status,
          sort_order: parseInt(infoForm.sort_order, 10) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setInfoError(data.error ?? "Failed to save"); return; }
      setCollection((c) => ({ ...c, ...data }));
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    } finally {
      setSavingInfo(false);
    }
  }

  /* ── Scene upload ──────────────────────────── */

  async function handleSceneUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScene(true);
    setSceneError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("sort_order", String(collection.collection_scenes.length));
      const res = await fetch(`/api/admin/collections/${collection.id}/scenes`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setSceneError(data.error ?? "Upload failed"); return; }
      setCollection((c) => ({
        ...c,
        collection_scenes: [...c.collection_scenes, { ...data, imageUrl: "", mobileImageUrl: null, collection_scene_tags: [] }],
      }));
      window.location.reload();
    } finally {
      setUploadingScene(false);
      e.target.value = "";
    }
  }

  async function updateSceneCaption(sceneId: string, caption: string) {
    await fetch(`/api/admin/collections/${collection.id}/scenes/${sceneId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: caption || null }),
    });
    setCollection((c) => ({
      ...c,
      collection_scenes: c.collection_scenes.map((s) =>
        s.id === sceneId ? { ...s, caption: caption || null } : s
      ),
    }));
  }

  async function deleteScene(sceneId: string) {
    if (!confirm("Delete this scene? This will also remove all product tags on it.")) return;
    const res = await fetch(`/api/admin/collections/${collection.id}/scenes/${sceneId}`, { method: "DELETE" });
    if (res.ok) {
      setCollection((c) => ({
        ...c,
        collection_scenes: c.collection_scenes.filter((s) => s.id !== sceneId),
      }));
      if (expandedTagger === sceneId) setExpandedTagger(null);
    }
  }

  /* ── Product search ────────────────────────── */

  function runProductSearch(q: string) {
    if (productDebounce.current) clearTimeout(productDebounce.current);
    if (q.trim().length < 2) { setProductResults([]); return; }
    productDebounce.current = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setProductResults(json.results ?? []);
      } finally { setSearchingProducts(false); }
    }, 250);
  }

  async function addProduct(productId: string) {
    setAddingProduct(true);
    try {
      const res = await fetch(`/api/admin/collections/${collection.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, sort_order: collection.collection_products.length }),
      });
      if (!res.ok) return;
      const data: CollectionProduct = await res.json();
      setCollection((c) => ({ ...c, collection_products: [...c.collection_products, data] }));
      setProductSearch("");
      setProductResults([]);
    } finally { setAddingProduct(false); }
  }

  async function removeProduct(productId: string) {
    const res = await fetch(`/api/admin/collections/${collection.id}/products`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    if (res.ok) {
      setCollection((c) => ({
        ...c,
        collection_products: c.collection_products.filter((cp) => cp.products?.id !== productId),
      }));
    }
  }

  const alreadyAdded = new Set(collection.collection_products.map((cp) => cp.products?.id));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/collections-admin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            ← Collections
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1 truncate">{collection.name}</h1>
          <Link
            href={`/collections/${collection.slug}`}
            target="_blank"
            className="text-xs text-gray-400 hover:text-emerald-600 transition-colors"
          >
            View live ↗
          </Link>
        </div>

        {/* ── Collection Info ─────────────────── */}
        <SectionCard title="Collection Info">
          <form onSubmit={saveInfo} className="space-y-4">
            {infoError && <p className="text-sm text-red-500">{infoError}</p>}
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Name" value={infoForm.name} onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input label="Slug" value={infoForm.slug} onChange={(e) => setInfoForm((f) => ({ ...f, slug: e.target.value }))} required />
            </div>
            <Input label="Subtitle" value={infoForm.subtitle} onChange={(e) => setInfoForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="One-line tagline shown on the collection page" />
            <Textarea label="Description" value={infoForm.description} onChange={(e) => setInfoForm((f) => ({ ...f, description: e.target.value }))} placeholder="Shown between hero and masonry grid" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={infoForm.status}
                  onChange={(e) => setInfoForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <Input label="Sort Order" type="number" value={infoForm.sort_order} onChange={(e) => setInfoForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingInfo} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {savingInfo ? "Saving…" : "Save Changes"}
              </button>
              {infoSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
            </div>
          </form>
        </SectionCard>

        {/* ── Collection Scenes ──────────────── */}
        <SectionCard title="Collection Scenes">
          {sceneError && <p className="text-sm text-red-500 mb-3">{sceneError}</p>}

          <label className={`block w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium text-center cursor-pointer transition-colors mb-5 ${
            uploadingScene
              ? "border-emerald-300 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
              : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
          }`}>
            {uploadingScene ? "Uploading…" : "+ Upload Collection Scene"}
            <input type="file" accept="image/*" className="hidden" onChange={handleSceneUpload} disabled={uploadingScene} />
          </label>

          <div className="space-y-6">
            {collection.collection_scenes.map((scene, i) => (
              <div key={scene.id} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-6 text-center">{i + 1}</span>
                  <input
                    defaultValue={scene.caption ?? ""}
                    onBlur={(e) => updateSceneCaption(scene.id, e.target.value)}
                    placeholder="Caption (optional)…"
                    className="flex-1 text-sm bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedTagger(expandedTagger === scene.id ? null : scene.id)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                      expandedTagger === scene.id
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    }`}
                  >
                    Tag Products {scene.collection_scene_tags.length > 0 ? `(${scene.collection_scene_tags.length})` : ""}
                  </button>
                  <button type="button" onClick={() => deleteScene(scene.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors px-1">
                    Delete
                  </button>
                </div>

                {scene.imageUrl && expandedTagger !== scene.id && (
                  <div className="relative bg-gray-100 dark:bg-gray-800 max-h-64 overflow-hidden">
                    <Image src={scene.imageUrl} alt="" width={800} height={500} className="w-full h-full object-cover" unoptimized />
                  </div>
                )}

                {expandedTagger === scene.id && (
                  <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
                    <SceneTagEditor
                      scene={scene}
                      collectionId={collection.id}
                      onTagAdded={(sceneId, tag) => {
                        setCollection((c) => ({
                          ...c,
                          collection_scenes: c.collection_scenes.map((s) =>
                            s.id === sceneId ? { ...s, collection_scene_tags: [...s.collection_scene_tags, tag] } : s
                          ),
                        }));
                      }}
                      onTagRemoved={(sceneId, tagId) => {
                        setCollection((c) => ({
                          ...c,
                          collection_scenes: c.collection_scenes.map((s) =>
                            s.id === sceneId ? { ...s, collection_scene_tags: s.collection_scene_tags.filter((t) => t.id !== tagId) } : s
                          ),
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {collection.collection_scenes.length === 0 && (
              <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-6">No scenes yet — upload an image above.</p>
            )}
          </div>
        </SectionCard>

        {/* ── Shop the Collection Products ──── */}
        <SectionCard title="Shop the Collection">
          <div className="mb-4 space-y-2">
            <input
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); runProductSearch(e.target.value); }}
              placeholder="Search products to add…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchingProducts && <p className="text-xs text-gray-400">Searching…</p>}
            {productResults.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {productResults.map((p) => {
                  const added = alreadyAdded.has(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-gray-900">
                      {p.images?.[0] && (
                        <Image src={productThumbUrl(p.images[0])} alt="" width={32} height={32} className="rounded object-cover shrink-0" unoptimized />
                      )}
                      <span className="text-sm flex-1 truncate text-gray-800 dark:text-gray-200">{p.name}</span>
                      {added ? (
                        <span className="text-xs text-gray-400">Already added</span>
                      ) : (
                        <button
                          type="button"
                          disabled={addingProduct}
                          onClick={() => addProduct(p.id)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {collection.collection_products.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No products assigned. Search above to add.</p>
          ) : (
            <div className="space-y-2">
              {collection.collection_products.map((cp, i) => {
                const p = cp.products;
                if (!p) return null;
                return (
                  <div key={cp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <span className="text-xs text-gray-300 dark:text-gray-600 w-5 text-center">{i + 1}</span>
                    {p.images?.[0] && (
                      <Image src={productThumbUrl(p.images[0])} alt="" width={36} height={36} className="rounded object-cover shrink-0" unoptimized />
                    )}
                    <span className="text-sm flex-1 truncate text-gray-800 dark:text-gray-200">{p.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{p.category}</span>
                    <button type="button" onClick={() => removeProduct(p.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0">Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

      </div>
    </main>
  );
}
