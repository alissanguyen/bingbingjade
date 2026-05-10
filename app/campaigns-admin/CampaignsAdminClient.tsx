"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaign-categories";
import { slugify } from "@/lib/slug";

export type CampaignEvent = {
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
  created_at: string;
  product_count: number;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  draft:  { label: "Draft",  badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  active: { label: "Active", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  ended:  { label: "Ended",  badge: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
};

const EMPTY_FORM = {
  name: "",
  slug: "",
  category: "",
  description: "",
  banner_message: "",
  starts_at: "",
  ends_at: "",
  status: "draft" as "draft" | "active" | "ended",
  discount_type: "" as "" | "fixed" | "percent",
  discount_value: "",
  coupon_code: "",
  allow_coupon_stack: false,
};

const inputCls =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateRange(starts: string | null, ends: string | null) {
  if (!starts && !ends) return null;
  if (starts && ends) return `${fmt(starts)} – ${fmt(ends)}`;
  if (starts) return `From ${fmt(starts)}`;
  return `Until ${fmt(ends!)}`;
}

export function CampaignsAdminClient({ campaigns: initial }: { campaigns: CampaignEvent[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug === slugify(f.name) || f.slug === "" ? slugify(name) : f.slug,
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.category) { setError("Category is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          category: form.category,
          description: form.description.trim() || null,
          banner_message: form.banner_message.trim() || null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          status: form.status,
          discount_type: form.discount_type || null,
          discount_value: form.discount_value ? Number(form.discount_value) : null,
          coupon_code: form.coupon_code.trim() || null,
          allow_coupon_stack: form.allow_coupon_stack,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setCampaigns((prev) => [{ ...data, product_count: 0 }, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      showToast("Campaign created.");
      router.push(`/campaigns-admin/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(campaign: CampaignEvent) {
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      showToast("Campaign deleted.");
    }
  }

  const categoryMap = Object.fromEntries(CAMPAIGN_CATEGORIES.map((c) => [c.value, c]));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign Events</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Holiday and event-based sale campaigns with dedicated sale pages.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setError(null); }}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
        >
          {showForm ? "Cancel" : "New Campaign"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Campaign Event</h2>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Mother's Day 2026"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                required
                className={inputCls}
              >
                <option value="">Select category…</option>
                {CAMPAIGN_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slug <span className="text-gray-400 font-normal">(auto-generated, editable)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 shrink-0">/sale/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="mothers-day-2026"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Shown on the sale page below the campaign title"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Banner Message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.banner_message}
              onChange={(e) => setField("banner_message", e.target.value)}
              placeholder="e.g. Celebrate the women who inspire us · Free shipping on all orders"
              className={inputCls}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setField("starts_at", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setField("ends_at", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputCls}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Discount Type <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select value={form.discount_type} onChange={(e) => setField("discount_type", e.target.value)} className={inputCls}>
                <option value="">No campaign-wide discount</option>
                <option value="percent">Percent off (%)</option>
                <option value="fixed">Fixed off ($)</option>
              </select>
            </div>
            {form.discount_type && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Discount Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    {form.discount_type === "percent" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={form.discount_type === "percent" ? 100 : undefined}
                    step={form.discount_type === "percent" ? 1 : 0.01}
                    value={form.discount_value}
                    onChange={(e) => setField("discount_value", e.target.value)}
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Coupon Code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.coupon_code}
                onChange={(e) => setField("coupon_code", e.target.value.toUpperCase())}
                placeholder="e.g. JADE20"
                className={`${inputCls} font-mono uppercase tracking-widest`}
              />
              <p className="mt-1 text-[11px] text-gray-400">If set, required at checkout to apply campaign discount.</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="allow_coupon_stack"
                checked={form.allow_coupon_stack}
                onChange={(e) => setField("allow_coupon_stack", e.target.checked)}
                className="accent-emerald-600 w-4 h-4"
              />
              <label htmlFor="allow_coupon_stack" className="text-sm text-gray-700 dark:text-gray-300">
                Allow coupon stacking
                <span className="block text-[11px] text-gray-400">Let customers combine this with other discounts</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Campaign"}
            </button>
          </div>
        </form>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 && !showForm ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <p className="text-sm">No campaigns yet.</p>
          <p className="text-xs mt-1">Create your first campaign event to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const cat = categoryMap[c.category];
            const sm = STATUS_META[c.status] ?? STATUS_META.draft;
            const dateRange = fmtDateRange(c.starts_at, c.ends_at);
            return (
              <div
                key={c.id}
                className="group flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                {/* Category emoji */}
                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl shrink-0">
                  {cat?.emoji ?? "◆"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${sm.badge}`}>
                      {sm.label}
                    </span>
                    {c.coupon_code && (
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        {c.coupon_code}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {dateRange && <span className="text-[11px] text-gray-400">{dateRange}</span>}
                    <span className="text-[11px] text-gray-400">{c.product_count} product{c.product_count !== 1 ? "s" : ""}</span>
                    {c.discount_type && c.discount_value != null && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        {c.discount_type === "percent" ? `${c.discount_value}% off` : `$${c.discount_value} off`}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-300 dark:text-gray-700">/sale/{c.slug}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`/sale/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-2 py-1"
                  >
                    View ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => router.push(`/campaigns-admin/${c.id}`)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  >
                    Manage
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors px-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
