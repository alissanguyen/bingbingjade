"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { CAMPAIGN_CATEGORIES, categoryLabel, categoryEmoji } from "@/lib/campaign-categories";
import { slugify } from "@/lib/slug";

type CampaignEvent = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  banner_message: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "draft" | "active" | "ended";
  discount_type: "fixed" | "percent" | null;
  discount_value: number | null;
  coupon_code: string | null;
  allow_coupon_stack: boolean;
};

type CampaignProduct = {
  id: string;
  product_id: string;
  event_price_usd: number | null;
  sort_order: number;
  is_featured_for_email: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    category: string;
    price_display_usd: number | null;
    sale_price_usd: number | null;
    status: string;
    imageUrl: string | null;
  };
};

type AvailableProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  imageUrl: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelet", bangle: "Bangle", ring: "Ring", pendant: "Pendant",
  necklace: "Necklace", set: "Set", earring: "Earrings", raw_material: "Raw Material",
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  draft:  { label: "Draft",  badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  active: { label: "Active", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  ended:  { label: "Ended",  badge: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
};

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400";

export function CampaignDetailClient({
  campaign: initialCampaign,
  campaignProducts: initialProducts,
  allProducts,
}: {
  campaign: CampaignEvent;
  campaignProducts: CampaignProduct[];
  allProducts: AvailableProduct[];
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [campaignProducts, setCampaignProducts] = useState(initialProducts);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialCampaign, discount_type: initialCampaign.discount_type ?? "", discount_value: initialCampaign.discount_value?.toString() ?? "", coupon_code: initialCampaign.coupon_code ?? "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Product picker state
  const [pickerQuery, setPickerQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null); // productId being added

  // Event price editing: map of campaign_event_products.product_id → draft price
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Products already in campaign (for de-duplication in picker)
  const inCampaignIds = useMemo(() => new Set(campaignProducts.map((cp) => cp.product_id)), [campaignProducts]);

  // Filtered picker products
  const filteredPicker = useMemo(() => {
    const q = pickerQuery.toLowerCase();
    return allProducts.filter(
      (p) => !inCampaignIds.has(p.id) && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [allProducts, inCampaignIds, pickerQuery]);

  // ── Campaign edit ──────────────────────────────────────────────────────────

  function setEditField(key: string, value: string | boolean) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(name: string) {
    setEditForm((f) => ({
      ...f,
      name,
      slug: f.slug === slugify(f.name) || f.slug === "" ? slugify(name) : f.slug,
    }));
  }

  async function handleSaveCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          category: editForm.category,
          description: editForm.description || null,
          banner_message: editForm.banner_message || null,
          starts_at: editForm.starts_at || null,
          ends_at: editForm.ends_at || null,
          status: editForm.status,
          discount_type: (editForm as { discount_type: string }).discount_type || null,
          discount_value: (editForm as { discount_value: string }).discount_value ? Number((editForm as { discount_value: string }).discount_value) : null,
          coupon_code: (editForm as { coupon_code: string }).coupon_code.trim() || null,
          allow_coupon_stack: editForm.allow_coupon_stack,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? "Save failed."); return; }
      setCampaign(data);
      setEditing(false);
      showToast("Campaign updated.");
    } finally {
      setSaving(false);
    }
  }

  // ── Product management ─────────────────────────────────────────────────────

  async function handleAddProduct(productId: string) {
    setAdding(productId);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to add product."); return; }
      // Merge the response row with the product info from allProducts
      const productInfo = allProducts.find((p) => p.id === productId)!;
      setCampaignProducts((prev) => [
        ...prev,
        {
          id: data.id,
          product_id: productId,
          event_price_usd: data.event_price_usd,
          sort_order: data.sort_order,
          is_featured_for_email: data.is_featured_for_email,
          product: productInfo,
        },
      ]);
      showToast("Product added to campaign.");
    } finally {
      setAdding(null);
    }
  }

  async function handleSaveEventPrice(cp: CampaignProduct) {
    const rawPrice = draftPrices[cp.product_id];
    const price = rawPrice !== undefined ? (rawPrice === "" ? null : Number(rawPrice)) : cp.event_price_usd;
    setSavingPrice(cp.product_id);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/products/${cp.product_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_price_usd: price }),
      });
      if (res.ok) {
        setCampaignProducts((prev) =>
          prev.map((p) => p.product_id === cp.product_id ? { ...p, event_price_usd: price } : p)
        );
        setDraftPrices((d) => { const next = { ...d }; delete next[cp.product_id]; return next; });
        showToast("Event price saved.");
      }
    } finally {
      setSavingPrice(null);
    }
  }

  async function handleToggleFeatured(cp: CampaignProduct) {
    const next = !cp.is_featured_for_email;
    await fetch(`/api/admin/campaigns/${campaign.id}/products/${cp.product_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_featured_for_email: next }),
    });
    setCampaignProducts((prev) =>
      prev.map((p) => p.product_id === cp.product_id ? { ...p, is_featured_for_email: next } : p)
    );
  }

  async function handleRemoveProduct(cp: CampaignProduct) {
    setRemoving(cp.product_id);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/products/${cp.product_id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaignProducts((prev) => prev.filter((p) => p.product_id !== cp.product_id));
        showToast("Product removed.");
      }
    } finally {
      setRemoving(null);
    }
  }

  const sm = STATUS_META[campaign.status] ?? STATUS_META.draft;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Back */}
      <Link
        href="/campaigns-admin"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Campaign Events
      </Link>

      {/* Campaign header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{categoryEmoji(campaign.category)}</span>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${sm.badge}`}>
                  {sm.label}
                </span>
                <span className="text-[11px] text-gray-400">{categoryLabel(campaign.category)}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/sale/${campaign.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              View Sale Page ↗
            </a>
            <button
              type="button"
              onClick={() => { setEditing((v) => !v); setEditError(null); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>

        {!editing ? (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
            {campaign.description && <p className="sm:col-span-2 text-gray-600 dark:text-gray-300">{campaign.description}</p>}
            {campaign.banner_message && <p className="sm:col-span-2 italic">&ldquo;{campaign.banner_message}&rdquo;</p>}
            <div className="flex gap-4">
              {campaign.starts_at && <span>Starts {new Date(campaign.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
              {campaign.ends_at && <span>Ends {new Date(campaign.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
            </div>
            <div className="flex gap-4">
              {campaign.discount_type && campaign.discount_value != null && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {campaign.discount_type === "percent" ? `${campaign.discount_value}% off` : `$${campaign.discount_value} off`} (campaign-wide)
                </span>
              )}
              {campaign.coupon_code && (
                <span className="font-mono text-amber-600 dark:text-amber-400">{campaign.coupon_code}</span>
              )}
            </div>
            <p className="text-[11px] text-gray-300 dark:text-gray-700">/sale/{campaign.slug}</p>
          </div>
        ) : (
          <form onSubmit={handleSaveCampaign} className="space-y-4 mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            {editError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {editError}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => handleNameChange(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={editForm.category} onChange={(e) => setEditField("category", e.target.value)} required className={inputCls}>
                  {CAMPAIGN_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 shrink-0">/sale/</span>
                <input type="text" value={editForm.slug} onChange={(e) => setEditField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea rows={2} value={editForm.description ?? ""} onChange={(e) => setEditField("description", e.target.value)} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Banner Message</label>
              <input type="text" value={editForm.banner_message ?? ""} onChange={(e) => setEditField("banner_message", e.target.value)} className={inputCls} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditField("status", e.target.value)} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input type="datetime-local" value={editForm.starts_at ?? ""} onChange={(e) => setEditField("starts_at", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input type="datetime-local" value={editForm.ends_at ?? ""} onChange={(e) => setEditField("ends_at", e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Type</label>
                <select value={(editForm as { discount_type: string }).discount_type} onChange={(e) => setEditField("discount_type", e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Discount Value</label>
                <input type="number" min={0} step={0.01} value={(editForm as { discount_value: string }).discount_value} onChange={(e) => setEditField("discount_value", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Coupon Code</label>
                <input type="text" value={(editForm as { coupon_code: string }).coupon_code} onChange={(e) => setEditField("coupon_code", e.target.value.toUpperCase())} className={`${inputCls} font-mono uppercase tracking-widest`} />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={editForm.allow_coupon_stack} onChange={(e) => setEditField("allow_coupon_stack", e.target.checked)} className="accent-emerald-600 w-4 h-4" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Allow coupon stacking</span>
            </label>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setEditing(false); setEditError(null); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Campaign products */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Campaign Products</h2>
          <span className="text-xs text-gray-400">{campaignProducts.length} product{campaignProducts.length !== 1 ? "s" : ""}</span>
        </div>

        {campaignProducts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No products added yet — use the picker below.</p>
        ) : (
          <div className="space-y-3">
            {campaignProducts.map((cp) => {
              const draftPrice = draftPrices[cp.product_id];
              const currentDraft = draftPrice !== undefined ? draftPrice : (cp.event_price_usd?.toString() ?? "");
              const isDirty = draftPrice !== undefined && draftPrice !== (cp.event_price_usd?.toString() ?? "");
              return (
                <div key={cp.product_id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                  {/* Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                    {cp.product.imageUrl
                      ? <Image src={cp.product.imageUrl} alt={cp.product.name} width={48} height={48} unoptimized className="object-cover w-full h-full" />
                      : <div className="w-full h-full flex items-center justify-center text-lg">🪨</div>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cp.product.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {CATEGORY_LABELS[cp.product.category] ?? cp.product.category}
                      {cp.product.price_display_usd != null && ` · $${cp.product.price_display_usd}`}
                    </p>
                  </div>

                  {/* Event price */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={currentDraft}
                        onChange={(e) => setDraftPrices((d) => ({ ...d, [cp.product_id]: e.target.value }))}
                        placeholder="Event price"
                        className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-6 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
                      />
                    </div>
                    {isDirty && (
                      <button
                        type="button"
                        disabled={savingPrice === cp.product_id}
                        onClick={() => handleSaveEventPrice(cp)}
                        className="text-xs font-medium px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                      >
                        {savingPrice === cp.product_id ? "…" : "Save"}
                      </button>
                    )}
                  </div>

                  {/* Featured toggle */}
                  <button
                    type="button"
                    title={cp.is_featured_for_email ? "Featured in email" : "Not featured in email"}
                    onClick={() => handleToggleFeatured(cp)}
                    className={`shrink-0 text-lg transition-opacity ${cp.is_featured_for_email ? "opacity-100" : "opacity-25 hover:opacity-60"}`}
                  >
                    ⭐
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    disabled={removing === cp.product_id}
                    onClick={() => handleRemoveProduct(cp)}
                    className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 px-1"
                  >
                    {removing === cp.product_id ? "…" : "✕"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product picker */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Add Products</h2>
        <p className="text-[11px] text-gray-400 mb-4">Search published products and add them to this campaign. Set per-product event prices above after adding.</p>

        <input
          type="text"
          value={pickerQuery}
          onChange={(e) => setPickerQuery(e.target.value)}
          placeholder="Search by name or category…"
          className={`${inputCls} mb-4`}
        />

        {filteredPicker.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {pickerQuery ? "No matching products." : "All published products are already in this campaign."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {filteredPicker.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={adding === p.id}
                onClick={() => handleAddProduct(p.id)}
                className="relative text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-600 transition-all disabled:opacity-50 group"
              >
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                  {p.imageUrl
                    ? <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" sizes="150px" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>
                  }
                  <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors flex items-center justify-center">
                    <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                  </div>
                  {adding === p.id && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Adding…</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-0.5">{p.name}</p>
                  {p.price_display_usd != null && (
                    <p className="text-[11px] text-gray-500">${p.price_display_usd}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
