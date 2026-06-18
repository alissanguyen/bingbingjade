"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Batch {
  id: string;
  name: string;
  batch_code: string | null;
  vendor: string | null;
  status: string;
  purchase_date: string | null;
  received_date: string | null;
  total_batch_cost_usd: number | null;
  item_count: number | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft:      "Draft",
  in_transit: "In Transit",
  received:   "Received",
  closed:     "Closed",
};
const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  received:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closed:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const COST_FIELDS = [
  { key: "goods_cost_usd",        label: "Goods Cost" },
  { key: "freight_cost_usd",      label: "Int'l Freight" },
  { key: "insurance_cost_usd",    label: "Insurance" },
  { key: "duties_cost_usd",       label: "Duties / Tariffs" },
  { key: "certification_cost_usd", label: "Cert / Lab" },
  { key: "misc_cost_usd",         label: "Miscellaneous" },
] as const;

function fmtUSD(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const BLANK_FORM = {
  name: "", batch_code: "", vendor: "", purchase_date: "", received_date: "",
  status: "draft",
  goods_cost_usd: "", freight_cost_usd: "", insurance_cost_usd: "",
  duties_cost_usd: "", certification_cost_usd: "", misc_cost_usd: "",
  item_count: "",
  notes: "",
};

type Period = "all" | "1m" | "3m" | "6m" | "1y";
const PERIOD_LABELS: Record<Period, string> = {
  all: "All time", "1m": "Last month", "3m": "Last 3 months", "6m": "Last 6 months", "1y": "Last year",
};

interface BatchSummary {
  total_spent: number;
  product_count: number;
  sold_count: number;
  revenue: number;
  net_profit: number;
}

export function InventoryBatchesClient({ initialBatches }: { initialBatches: Batch[] }) {
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("all");
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    setSummaryLoading(true);
    fetch(`/api/admin/inventory-batches/summary?period=${period}`)
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .finally(() => setSummaryLoading(false));
  }, [period]);

  const cutoff = (() => {
    if (period === "all") return null;
    const d = new Date();
    if (period === "1m") d.setMonth(d.getMonth() - 1);
    if (period === "3m") d.setMonth(d.getMonth() - 3);
    if (period === "6m") d.setMonth(d.getMonth() - 6);
    if (period === "1y") d.setFullYear(d.getFullYear() - 1);
    return d;
  })();

  const filteredBatches = cutoff
    ? batches.filter((b) => {
        const ds = b.purchase_date ?? b.created_at;
        return ds ? new Date(ds) >= cutoff : false;
      })
    : batches;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...form };
      for (const { key } of COST_FIELDS) body[key] = parseFloat(form[key] || "0") || 0;
      body.item_count = form.item_count ? parseInt(form.item_count, 10) || null : null;
      const res = await fetch("/api/admin/inventory-batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create batch."); return; }
      setBatches((prev) => [data.batch, ...prev]);
      setShowCreate(false);
      setForm({ ...BLANK_FORM });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory Batches</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Track purchase batches and allocate costs to products
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Batch
          </button>
        </div>

        {/* Period filter + summary */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Portfolio Summary</p>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
              ))}
            </select>
          </div>
          {summaryLoading ? (
            <div className="h-10 flex items-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
          ) : summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Total Spent</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{fmtUSD(summary.total_spent)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Products</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{summary.product_count}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Sold</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {summary.sold_count}
                  {summary.product_count > 0 && (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ({Math.round((summary.sold_count / summary.product_count) * 100)}%)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Revenue</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{fmtUSD(summary.revenue)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Net Profit</p>
                <p className={`text-base font-bold ${summary.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {fmtUSD(summary.net_profit)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Inventory Batch</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
              </div>
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Batch Name <span className="text-red-400">*</span></label>
                    <input required value={form.name} onChange={set("name")} placeholder="e.g. Vietnam May 2026" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Batch Code</label>
                    <input value={form.batch_code} onChange={set("batch_code")} placeholder="e.g. VN-2026-05" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Vendor / Supplier</label>
                    <input value={form.vendor} onChange={set("vendor")} placeholder="Vendor name" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.status} onChange={set("status")} className={inputCls}>
                      <option value="draft">Draft</option>
                      <option value="in_transit">In Transit</option>
                      <option value="received">Received</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Purchase Date</label>
                    <input type="date" value={form.purchase_date} onChange={set("purchase_date")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Received Date</label>
                    <input type="date" value={form.received_date} onChange={set("received_date")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Item Count <span className="text-gray-400 font-normal">(for avg cost only)</span></label>
                    <input type="number" min="1" step="1" value={form.item_count} onChange={set("item_count")} placeholder="e.g. 24" className={inputCls} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Cost Breakdown</p>
                  <div className="grid grid-cols-2 gap-3">
                    {COST_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={form[key]} onChange={set(key)}
                            placeholder="0.00"
                            className={`${inputCls} pl-7`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Optional notes…" className={`${inputCls} resize-none`} />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                    {saving ? "Creating…" : "Create Batch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Batch list */}
        {filteredBatches.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-8 py-16 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {batches.length === 0 ? "No inventory batches yet." : `No batches in ${PERIOD_LABELS[period].toLowerCase()}.`}
            </p>
            {batches.length === 0 && <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Create your first batch to start tracking inventory costs.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((b) => (
              <Link
                key={b.id}
                href={`/inventory-batches/${b.id}`}
                className="block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{b.name}</p>
                      {b.batch_code && (
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">{b.batch_code}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? STATUS_COLORS.draft}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                      {b.vendor && <span>{b.vendor}</span>}
                      {b.purchase_date && <span>Purchased {fmtDate(b.purchase_date)}</span>}
                      {b.received_date && <span>Received {fmtDate(b.received_date)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{fmtUSD(b.total_batch_cost_usd)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">total cost</p>
                    {b.item_count != null && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{b.item_count} items</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
