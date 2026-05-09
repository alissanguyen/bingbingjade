"use client";

import { useEffect, useState, useCallback } from "react";

interface Expense {
  id: string;
  expense_date: string;
  vendor: string | null;
  category: string;
  amount_usd: number;
  payment_method: string | null;
  receipt_url: string | null;
  business_use_percent: number;
  deductible_amount_usd: number;
  notes: string | null;
}

const CATEGORIES = [
  "software", "ads", "equipment", "licenses", "domain",
  "office", "supplies", "shipping", "professional_services", "other",
];

const EMPTY_FORM = {
  expense_date: new Date().toISOString().slice(0, 10),
  vendor: "",
  category: "software",
  amount_usd: "",
  payment_method: "",
  receipt_url: "",
  business_use_percent: "100",
  notes: "",
};

const THIS_YEAR = new Date().getFullYear().toString();

export function ExpensesTab() {
  const [expenses, setExpenses]         = useState<Expense[]>([]);
  const [total, setTotal]               = useState(0);
  const [shippingExpenses, setShippingExpenses] = useState(0);
  const [labelCosts, setLabelCosts]             = useState(0);
  const [shippingRevenue, setShippingRevenue]   = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [from, setFrom]           = useState(`${THIS_YEAR}-01-01`);
  const [to, setTo]               = useState(`${THIS_YEAR}-12-31`);
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const LIMIT = 100;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (from)      params.set("from", from);
      if (to)        params.set("to", to);
      if (catFilter) params.set("category", catFilter);
      const res = await fetch(`/api/admin/full-accounting/expenses?${params}`);
      const json = await res.json();
      setExpenses(json.expenses ?? []);
      setTotal(json.total ?? 0);
      setShippingExpenses(json.shippingExpenses ?? 0);
      setLabelCosts(json.labelCosts ?? 0);
      setShippingRevenue(json.shippingRevenue ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [from, to, catFilter]);

  useEffect(() => { load(1); }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMsg(null);
  }

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      expense_date:         e.expense_date,
      vendor:               e.vendor ?? "",
      category:             e.category,
      amount_usd:           String(e.amount_usd),
      payment_method:       e.payment_method ?? "",
      receipt_url:          e.receipt_url ?? "",
      business_use_percent: String(e.business_use_percent),
      notes:                e.notes ?? "",
    });
    setShowForm(true);
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        expense_date:         form.expense_date,
        vendor:               form.vendor || null,
        category:             form.category,
        amount_usd:           parseFloat(form.amount_usd) || 0,
        payment_method:       form.payment_method || null,
        receipt_url:          form.receipt_url || null,
        business_use_percent: parseFloat(form.business_use_percent) ?? 100,
        notes:                form.notes || null,
      };

      const url  = editingId ? `/api/admin/full-accounting/expenses/${editingId}` : "/api/admin/full-accounting/expenses";
      const method = editingId ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        load(1);
        setMsg(editingId ? "Updated" : "Added expense");
      } else {
        const json = await res.json();
        setMsg(`Error: ${json.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/admin/full-accounting/expenses/${id}`, { method: "DELETE" });
    load(1);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const totalDeductible = expenses.reduce((s, e) => s + Number(e.deductible_amount_usd), 0);
  const totalAmount     = expenses.reduce((s, e) => s + Number(e.amount_usd), 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={() => load(1)}
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg">
          Apply
        </button>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <button onClick={startAdd}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">${totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Deductible</p>
          <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1">${totalDeductible.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Entries shown</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{total}</p>
        </div>
      </div>

      {/* Shipping delta */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Shipping Cost Delta (period)</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Collected from customers</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">${shippingRevenue.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400">via Stripe</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Spent on shipping</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">${(shippingExpenses + labelCosts).toFixed(2)}</p>
            <p className="text-[11px] text-gray-400">
              fulfillment: ${labelCosts.toFixed(2)} · expenses: ${shippingExpenses.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Delta</p>
            {(() => {
              const delta = shippingRevenue - (shippingExpenses + labelCosts);
              return (
                <>
                  <p className={`text-lg font-semibold mt-0.5 ${delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}${delta.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-400">{delta >= 0 ? "customers covered shipping" : "you subsidized shipping"}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editingId ? "Edit Expense" : "New Expense"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date *</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category *</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount USD *</label>
              <input type="number" step="0.01" value={form.amount_usd} onChange={(e) => setForm((p) => ({ ...p, amount_usd: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Business Use %</label>
              <input type="number" min="0" max="100" value={form.business_use_percent} onChange={(e) => setForm((p) => ({ ...p, business_use_percent: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vendor</label>
              <input type="text" value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Shopify"
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
              <input type="text" value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))} placeholder="e.g. Credit Card"
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Receipt URL</label>
              <input type="url" value={form.receipt_url} onChange={(e) => setForm((p) => ({ ...p, receipt_url: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          {form.amount_usd && form.business_use_percent && (
            <p className="text-xs text-gray-500">
              Deductible: ${((parseFloat(form.amount_usd) || 0) * (parseFloat(form.business_use_percent) || 100) / 100).toFixed(2)}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.expense_date || !form.amount_usd}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Update" : "Add"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No expenses in range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pl-4 pr-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Vendor</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-right">Biz %</th>
                  <th className="px-3 py-3 text-right">Deductible</th>
                  <th className="px-3 py-3 text-left">Method</th>
                  <th className="px-3 py-3 text-left">Notes</th>
                  <th className="pr-4 pl-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="pl-4 pr-3 py-2.5 text-gray-700 dark:text-gray-300">{e.expense_date}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 capitalize">
                        {e.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{e.vendor ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">${Number(e.amount_usd).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{e.business_use_percent}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">${Number(e.deductible_amount_usd).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{e.payment_method ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[160px] truncate">{e.notes ?? "—"}</td>
                    <td className="pr-4 pl-3 py-2.5">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(e)}
                          className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                          Edit
                        </button>
                        <button onClick={() => deleteExpense(e.id)}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
