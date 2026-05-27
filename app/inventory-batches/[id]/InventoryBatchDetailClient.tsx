"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface BatchItem {
  id: string;
  product_id: string | null;
  assigned_inventory_cost_usd: number;
  allocation_method: string;
  notes: string | null;
  created_at: string;
  productName: string | null;
  productImageUrl: string | null;
}

interface Batch {
  id: string;
  name: string;
  batch_code: string | null;
  vendor: string | null;
  status: string;
  purchase_date: string | null;
  received_date: string | null;
  goods_cost_usd: number;
  freight_cost_usd: number;
  insurance_cost_usd: number;
  duties_cost_usd: number;
  certification_cost_usd: number;
  misc_cost_usd: number;
  total_batch_cost_usd: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_transit: "In Transit", received: "Received", closed: "Closed",
};
const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  received:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closed:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const COST_FIELDS: { key: keyof Batch; label: string }[] = [
  { key: "goods_cost_usd",         label: "Goods Cost" },
  { key: "freight_cost_usd",       label: "Int'l Freight" },
  { key: "insurance_cost_usd",     label: "Insurance" },
  { key: "duties_cost_usd",        label: "Duties / Tariffs" },
  { key: "certification_cost_usd", label: "Cert / Lab" },
  { key: "misc_cost_usd",          label: "Miscellaneous" },
];

function fmtUSD(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ALLOC_LABELS: Record<string, string> = {
  manual: "Manual", proportional: "Proportional", equal: "Equal", legacy: "Legacy",
};

export function InventoryBatchDetailClient({ batch: initialBatch, items: initialItems }: { batch: Batch; items: BatchItem[] }) {
  const [batch, setBatch] = useState(initialBatch);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ product_id: "", assigned_inventory_cost_usd: "", allocation_method: "manual", notes: "" });
  const [savingItem, setSavingItem] = useState(false);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function startEdit() {
    setEditForm({
      name:                  batch.name,
      batch_code:            batch.batch_code ?? "",
      vendor:                batch.vendor ?? "",
      status:                batch.status,
      purchase_date:         batch.purchase_date ?? "",
      received_date:         batch.received_date ?? "",
      goods_cost_usd:        String(batch.goods_cost_usd),
      freight_cost_usd:      String(batch.freight_cost_usd),
      insurance_cost_usd:    String(batch.insurance_cost_usd),
      duties_cost_usd:       String(batch.duties_cost_usd),
      certification_cost_usd: String(batch.certification_cost_usd),
      misc_cost_usd:         String(batch.misc_cost_usd),
      notes:                 batch.notes ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editForm };
      for (const { key } of COST_FIELDS) body[key as string] = parseFloat(editForm[key as string] || "0") || 0;
      const res = await fetch(`/api/admin/inventory-batches/${batch.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Save failed."); return; }
      setBatch(data.batch);
      setEditing(false);
      showToast("ok", "Batch saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this batch? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/inventory-batches/${batch.id}`, { method: "DELETE" });
      if (!res.ok) { showToast("err", "Delete failed."); return; }
      window.location.href = "/inventory-batches";
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddItem(ev: React.FormEvent) {
    ev.preventDefault();
    setSavingItem(true);
    try {
      const res = await fetch(`/api/admin/inventory-batches/${batch.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: itemForm.product_id || null,
          assigned_inventory_cost_usd: parseFloat(itemForm.assigned_inventory_cost_usd || "0") || 0,
          allocation_method: itemForm.allocation_method,
          notes: itemForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add item."); return; }
      setItems((prev) => [...prev, data.item]);
      setShowAddItem(false);
      setItemForm({ product_id: "", assigned_inventory_cost_usd: "", allocation_method: "manual", notes: "" });
      showToast("ok", "Item added.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirm("Remove this item from the batch?")) return;
    const res = await fetch(`/api/admin/inventory-batches/${batch.id}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) { showToast("err", "Remove failed."); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    showToast("ok", "Item removed.");
  }

  const setItem = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setItemForm((f) => ({ ...f, [k]: e.target.value }));
  const setEdit = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  const allocatedTotal = items.reduce((s, i) => s + Number(i.assigned_inventory_cost_usd), 0);
  const unallocated = Number(batch.total_batch_cost_usd) - allocatedTotal;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === "ok" ? "bg-emerald-700 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">

        {/* Back */}
        <Link href="/inventory-batches" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          All Batches
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{batch.name}</h1>
              {batch.batch_code && <span className="font-mono text-sm text-gray-400 dark:text-gray-500">{batch.batch_code}</span>}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[batch.status] ?? STATUS_COLORS.draft}`}>
                {STATUS_LABELS[batch.status] ?? batch.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {batch.vendor && <span>{batch.vendor} · </span>}
              {batch.purchase_date && <span>Purchased {fmtDate(batch.purchase_date)} · </span>}
              {batch.received_date && <span>Received {fmtDate(batch.received_date)}</span>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!editing ? (
              <>
                <button onClick={startEdit} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Edit</button>
                <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs text-red-500 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50">Delete</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
              </>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 px-5 py-5 mb-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Batch Name</label>
                <input value={editForm.name ?? ""} onChange={setEdit("name")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Batch Code</label>
                <input value={editForm.batch_code ?? ""} onChange={setEdit("batch_code")} placeholder="e.g. VN-2026-05" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Vendor</label>
                <input value={editForm.vendor ?? ""} onChange={setEdit("vendor")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={editForm.status ?? "draft"} onChange={setEdit("status")} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="in_transit">In Transit</option>
                  <option value="received">Received</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div />
              <div>
                <label className={labelCls}>Purchase Date</label>
                <input type="date" value={editForm.purchase_date ?? ""} onChange={setEdit("purchase_date")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Received Date</label>
                <input type="date" value={editForm.received_date ?? ""} onChange={setEdit("received_date")} className={inputCls} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Cost Breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                {COST_FIELDS.map(({ key, label }) => (
                  <div key={String(key)}>
                    <label className={labelCls}>{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <input type="number" min="0" step="0.01" value={editForm[key as string] ?? "0"} onChange={setEdit(key as string)} className={`${inputCls} pl-7`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={editForm.notes ?? ""} onChange={setEdit("notes")} rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
        )}

        {/* Cost summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Batch Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtUSD(batch.total_batch_cost_usd)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Allocated</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtUSD(allocatedTotal)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Unallocated</p>
            <p className={`text-lg font-bold ${unallocated > 0.01 ? "text-amber-500 dark:text-amber-400" : "text-gray-400"}`}>{fmtUSD(unallocated)}</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost Breakdown</h2>
          <div className="space-y-1.5">
            {COST_FIELDS.map(({ key, label }) => {
              const val = Number(batch[key]);
              if (!val) return null;
              return (
                <div key={String(key)} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{fmtUSD(val)}</span>
                </div>
              );
            })}
          </div>
          {batch.notes && <p className="mt-3 text-xs text-gray-400 italic">{batch.notes}</p>}
        </div>

        {/* Batch items */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Products in Batch ({items.length})
            </h2>
            <button onClick={() => setShowAddItem(true)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">+ Add product</button>
          </div>

          {/* Add item form */}
          {showAddItem && (
            <form onSubmit={handleAddItem} className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Product ID (UUID)</label>
                  <input value={itemForm.product_id} onChange={setItem("product_id")} placeholder="Paste product UUID" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Assigned Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input required type="number" min="0" step="0.01" value={itemForm.assigned_inventory_cost_usd} onChange={setItem("assigned_inventory_cost_usd")} placeholder="0.00" className={`${inputCls} pl-7`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Allocation Method</label>
                  <select value={itemForm.allocation_method} onChange={setItem("allocation_method")} className={inputCls}>
                    <option value="manual">Manual</option>
                    <option value="proportional">Proportional</option>
                    <option value="equal">Equal</option>
                    <option value="legacy">Legacy</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input value={itemForm.notes} onChange={setItem("notes")} placeholder="Optional" className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddItem(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
                <button type="submit" disabled={savingItem} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50">{savingItem ? "Adding…" : "Add"}</button>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No products linked to this batch yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  {item.productImageUrl ? (
                    <Image src={item.productImageUrl} alt={item.productName ?? ""} width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0" unoptimized />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.productName ?? <span className="text-gray-400 font-mono text-xs">{item.product_id ?? "Unknown"}</span>}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {ALLOC_LABELS[item.allocation_method] ?? item.allocation_method}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 shrink-0">{fmtUSD(item.assigned_inventory_cost_usd)}</p>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 shrink-0 ml-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
