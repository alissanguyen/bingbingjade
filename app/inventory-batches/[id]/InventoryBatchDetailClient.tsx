"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

interface BatchItem {
  id: string;
  product_id: string | null;
  assigned_inventory_cost_usd: number;
  item_expense_usd: number;
  allocation_method: string;
  notes: string | null;
  created_at: string;
  productName: string | null;
  productPublicId: string | null;
  productImageUrl: string | null;
  isSold: boolean;
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
  item_count: number | null;
  partner_payment_usd: number;
  payment_to_partner_usd: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductSearchResult {
  id: string;
  name: string;
  public_id: string;
  images: string[] | null;
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

export function InventoryBatchDetailClient({
  batch: initialBatch,
  items: initialItems,
  revenue,
  soldCount,
  totalCount,
}: {
  batch: Batch;
  items: BatchItem[];
  revenue: number;
  soldCount: number;
  totalCount: number;
}) {
  const [batch, setBatch] = useState(initialBatch);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    product_id: "",
    assigned_inventory_cost_usd: "",
    item_expense_usd: "",
    allocation_method: "manual",
    notes: "",
  });
  const [savingItem, setSavingItem] = useState(false);

  // Inline expense editing
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState("");

  // Proportional cost allocation
  const [isCalculating, setIsCalculating] = useState(false);

  // Product search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function startEdit() {
    setEditForm({
      name:                    batch.name,
      batch_code:              batch.batch_code ?? "",
      vendor:                  batch.vendor ?? "",
      status:                  batch.status,
      purchase_date:           batch.purchase_date ?? "",
      received_date:           batch.received_date ?? "",
      goods_cost_usd:          String(batch.goods_cost_usd),
      freight_cost_usd:        String(batch.freight_cost_usd),
      insurance_cost_usd:      String(batch.insurance_cost_usd),
      duties_cost_usd:         String(batch.duties_cost_usd),
      certification_cost_usd:  String(batch.certification_cost_usd),
      misc_cost_usd:           String(batch.misc_cost_usd),
      partner_payment_usd:     String(batch.partner_payment_usd ?? 0),
      payment_to_partner_usd:  String(batch.payment_to_partner_usd ?? 0),
      item_count:              batch.item_count != null ? String(batch.item_count) : "",
      notes:                   batch.notes ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editForm };
      for (const { key } of COST_FIELDS) body[key as string] = parseFloat(editForm[key as string] || "0") || 0;
      body.partner_payment_usd    = parseFloat(editForm.partner_payment_usd    || "0") || 0;
      body.payment_to_partner_usd = parseFloat(editForm.payment_to_partner_usd || "0") || 0;
      body.item_count             = editForm.item_count ? parseInt(editForm.item_count, 10) || null : null;
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

  // ── Product search handlers ──────────────────────────────────────────────

  function handleProductSearch(q: string) {
    setSearchQuery(q);
    setSearchOpen(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/inventory-batches/product-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectProduct(p: ProductSearchResult) {
    setItemForm((f) => ({ ...f, product_id: p.id }));
    setSearchQuery(`${p.name}  ·  ${p.public_id}`);
    setSearchResults([]);
    setSearchOpen(false);
  }

  function clearProductSelection() {
    setItemForm((f) => ({ ...f, product_id: "" }));
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  // ── Add / remove items ───────────────────────────────────────────────────

  async function handleAddItem(ev: React.FormEvent) {
    ev.preventDefault();
    setSavingItem(true);
    try {
      const res = await fetch(`/api/admin/inventory-batches/${batch.id}/items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: itemForm.product_id || null,
          assigned_inventory_cost_usd: parseFloat(itemForm.assigned_inventory_cost_usd || "0") || 0,
          item_expense_usd: parseFloat(itemForm.item_expense_usd || "0") || 0,
          allocation_method: itemForm.allocation_method,
          notes: itemForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add item."); return; }
      setItems((prev) => [...prev, data.item]);
      setShowAddItem(false);
      setItemForm({ product_id: "", assigned_inventory_cost_usd: "", item_expense_usd: "", allocation_method: "manual", notes: "" });
      setSearchQuery("");
      showToast("ok", "Item added.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleSaveExpense(item: BatchItem) {
    const val = parseFloat(expenseDraft || "0") || 0;
    const res = await fetch(`/api/admin/inventory-batches/${batch.id}/items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_expense_usd: val }),
    });
    if (!res.ok) { showToast("err", "Save failed."); return; }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, item_expense_usd: val } : i));
    setEditingExpenseId(null);
    showToast("ok", "Expense saved.");
  }

  async function handleCalculateAllocated() {
    setIsCalculating(true);
    try {
      const res = await fetch(`/api/admin/inventory-batches/${batch.id}/allocate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Allocation failed."); return; }
      const updatedMap = new Map<string, number>(
        (data.items ?? []).map((i: { id: string; assigned_inventory_cost_usd: number }) => [i.id, i.assigned_inventory_cost_usd])
      );
      setItems((prev) =>
        prev.map((item) =>
          updatedMap.has(item.id) ? { ...item, assigned_inventory_cost_usd: updatedMap.get(item.id)! } : item
        )
      );
      showToast("ok", `Allocated costs for ${data.items?.length ?? 0} proportional item${data.items?.length === 1 ? "" : "s"}.`);
    } finally {
      setIsCalculating(false);
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

  // Only count item expenses for sold items (shipping absorbed only when item ships)
  const totalItemExpenses = items
    .filter((i) => i.isSold)
    .reduce((s, i) => s + Number(i.item_expense_usd ?? 0), 0);
  const pendingItemExpenses = items
    .filter((i) => !i.isSold && Number(i.item_expense_usd) > 0)
    .reduce((s, i) => s + Number(i.item_expense_usd ?? 0), 0);

  // Financial summary
  const partnerIn  = Number(batch.partner_payment_usd ?? 0);
  const partnerOut = Number(batch.payment_to_partner_usd ?? 0);
  const totalCost  = Number(batch.total_batch_cost_usd);
  const grossProfit = revenue - totalCost - totalItemExpenses;
  const netProfit   = grossProfit + partnerIn - partnerOut;
  const soldPct     = totalCount > 0 ? Math.round((soldCount / totalCount) * 100) : 0;

  const hasProportionalItems = items.some((i) => i.allocation_method === "proportional");
  const missingItemCount = batch.item_count && items.length < batch.item_count ? batch.item_count - items.length : 0;

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
              <div>
                <label className={labelCls}>Item Count <span className="text-gray-400 font-normal">(for avg cost only)</span></label>
                <input type="number" min="1" step="1" value={editForm.item_count ?? ""} onChange={setEdit("item_count")} placeholder="e.g. 24" className={inputCls} />
              </div>
            </div>

            {/* Cost breakdown */}
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

            {/* Partner payments */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Partner Payments</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Partner Payment Received <span className="text-emerald-500">(+income)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" min="0" step="0.01" value={editForm.partner_payment_usd ?? "0"} onChange={setEdit("partner_payment_usd")} className={`${inputCls} pl-7`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Payment Back to Partner <span className="text-red-400">(−expense)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" min="0" step="0.01" value={editForm.payment_to_partner_usd ?? "0"} onChange={setEdit("payment_to_partner_usd")} className={`${inputCls} pl-7`} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={editForm.notes ?? ""} onChange={setEdit("notes")} rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
        )}

        {/* Cost summary cards */}
        <div className={`grid gap-3 mb-5 ${batch.item_count ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Batch Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{fmtUSD(batch.total_batch_cost_usd)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Allocated</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtUSD(allocatedTotal)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Unallocated</p>
            <p className={`text-lg font-bold ${unallocated > 0.01 ? "text-amber-500 dark:text-amber-400" : "text-gray-400"}`}>{fmtUSD(unallocated)}</p>
          </div>
          {batch.item_count ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Avg Cost / Item</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {fmtUSD(Number(batch.total_batch_cost_usd) / batch.item_count)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{batch.item_count} items</p>
            </div>
          ) : null}
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

        {/* Financial Summary */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Financial Summary</h2>
            {totalCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${soldPct}%` }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {soldPct}% sold ({soldCount}/{totalCount})
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Revenue from Sales</span>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">{fmtUSD(revenue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total Batch Cost</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">− {fmtUSD(totalCost)}</span>
            </div>
            {totalItemExpenses > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Item Expenses (sold items)</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">− {fmtUSD(totalItemExpenses)}</span>
              </div>
            )}
            {pendingItemExpenses > 0 && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Pending expenses (unsold items)</span>
                <span>− {fmtUSD(pendingItemExpenses)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-100 dark:border-gray-800 pt-1.5 mt-1.5">
              <span className="text-gray-600 dark:text-gray-300 font-medium">Gross Profit</span>
              <span className={`font-semibold ${grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtUSD(grossProfit)}</span>
            </div>

            {(partnerIn > 0 || partnerOut > 0) && (
              <>
                <div className="border-t border-dashed border-gray-100 dark:border-gray-800 pt-1.5 mt-1" />
                {partnerIn > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Partner Payment Received</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+ {fmtUSD(partnerIn)}</span>
                  </div>
                )}
                {partnerOut > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Payment Back to Partner</span>
                    <span className="font-medium text-red-500 dark:text-red-400">− {fmtUSD(partnerOut)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-100 dark:border-gray-800 pt-1.5 mt-1.5">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">Net Profit</span>
                  <span className={`font-semibold ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtUSD(netProfit)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Missing items banner */}
        {missingItemCount > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 mb-5 flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <span className="font-semibold">{missingItemCount} product{missingItemCount === 1 ? "" : "s"} not yet added</span>
              {" "}— batch was set to {batch.item_count} items but only {items.length} {items.length === 1 ? "has" : "have"} been linked.
            </p>
          </div>
        )}

        {/* Batch items */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Products in Batch ({items.length})
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {hasProportionalItems && (
                <button
                  type="button"
                  onClick={handleCalculateAllocated}
                  disabled={isCalculating}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 transition-colors"
                >
                  {isCalculating ? "Calculating…" : "Calculate Allocated Cost"}
                </button>
              )}
              <button onClick={() => { setShowAddItem(true); setSearchQuery(""); setItemForm({ product_id: "", assigned_inventory_cost_usd: "", item_expense_usd: "", allocation_method: "manual", notes: "" }); }} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">+ Add product</button>
            </div>
          </div>

          {/* Add item form */}
          {showAddItem && (
            <form onSubmit={handleAddItem} className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 space-y-3">
              <div className="grid grid-cols-2 gap-3">

                {/* Product search */}
                <div className="col-span-2">
                  <label className={labelCls}>Product (search by name or SKU)</label>
                  <div className="relative" ref={searchWrapperRef}>
                    <input
                      value={searchQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      onFocus={() => searchQuery && setSearchOpen(true)}
                      placeholder="Type product name or SKU…"
                      autoComplete="off"
                      className={inputCls}
                    />
                    {/* Clear button */}
                    {itemForm.product_id && (
                      <button
                        type="button"
                        onClick={clearProductSelection}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300"
                        aria-label="Clear"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                    {/* Dropdown */}
                    {searchOpen && (searchResults.length > 0 || searching) && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                        {searching && (
                          <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
                        )}
                        {searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProduct(p)}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                              <span className="block text-xs text-gray-400 font-mono">{p.public_id}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Selected product UUID hint */}
                  {itemForm.product_id && (
                    <p className="mt-1 text-[10px] text-gray-400 font-mono truncate">{itemForm.product_id}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Assigned Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input required={itemForm.allocation_method === "manual"} type="number" min="0" step="0.01" value={itemForm.assigned_inventory_cost_usd} onChange={setItem("assigned_inventory_cost_usd")} placeholder="0.00" className={`${inputCls} pl-7`} />
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
                <div>
                  <label className={labelCls}>Item Expense <span className="text-gray-400 font-normal">(e.g. shipping absorbed)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" min="0" step="0.01" value={itemForm.item_expense_usd} onChange={setItem("item_expense_usd")} placeholder="0.00" className={`${inputCls} pl-7`} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input value={itemForm.notes} onChange={setItem("notes")} placeholder="Optional" className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddItem(false); setSearchQuery(""); }} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Cancel</button>
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
                      {item.productPublicId && <span className="font-mono mr-1.5">{item.productPublicId}</span>}
                      {ALLOC_LABELS[item.allocation_method] ?? item.allocation_method}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{fmtUSD(item.assigned_inventory_cost_usd)}</p>
                    {/* Inline expense editor */}
                    {editingExpenseId === item.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">−$</span>
                        <input
                          autoFocus
                          type="number" min="0" step="0.01"
                          value={expenseDraft}
                          onChange={(e) => setExpenseDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveExpense(item); if (e.key === "Escape") setEditingExpenseId(null); }}
                          className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:border-emerald-500"
                        />
                        <button onClick={() => handleSaveExpense(item)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Save</button>
                        <button onClick={() => setEditingExpenseId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingExpenseId(item.id); setExpenseDraft(String(item.item_expense_usd ?? 0)); }}
                        className={`text-xs ${
                          Number(item.item_expense_usd) > 0
                            ? item.isSold
                              ? "text-amber-500 dark:text-amber-400"
                              : "text-gray-400 dark:text-gray-500"
                            : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                        }`}
                        title={Number(item.item_expense_usd) > 0 && !item.isSold ? "Will be counted when sold" : "Edit item expense"}
                      >
                        {Number(item.item_expense_usd) > 0
                          ? `−${fmtUSD(item.item_expense_usd)} exp.${!item.isSold ? " (pending)" : ""}`
                          : "+ expense"}
                      </button>
                    )}
                  </div>
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
