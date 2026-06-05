"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";

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

function ComboProfile({
  label,
  value,
  onChange,
  options,
  onAddOption,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddOption: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());
  const showAdd = query.trim() !== "" && !exactMatch;

  function pick(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div className="absolute z-30 top-full mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((o) => (
            <button key={o} type="button" onMouseDown={() => pick(o)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                o === value ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {o}
            </button>
          ))}
          {showAdd && (
            <button type="button" onMouseDown={() => { onAddOption(query.trim()); pick(query.trim()); }}
              className="w-full text-left px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-t border-gray-100 dark:border-gray-800"
            >
              + Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type SummaryRow = { name: string; total: number; deductible: number; count: number };
type Summary = { byVendor: SummaryRow[]; byMethod: SummaryRow[]; byCategory: SummaryRow[] };

function SummaryTable({ rows, label }: { rows: SummaryRow[]; label: string }) {
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              <th className="pl-3 pr-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right">Txns</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="pl-2 pr-3 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="pl-3 pr-2 py-2 text-gray-700 dark:text-gray-300 font-medium">{r.name}</td>
                <td className="px-2 py-2 text-right text-gray-400 tabular-nums">{r.count}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                  ${r.total.toFixed(2)}
                </td>
                <td className="pl-2 pr-3 py-2 text-right tabular-nums text-gray-400 text-xs">
                  {grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(0) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
              <td className="pl-3 pr-2 py-2 text-xs text-gray-500">Total</td>
              <td className="px-2 py-2 text-right text-xs text-gray-400 tabular-nums">
                {rows.reduce((s, r) => s + r.count, 0)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                ${grandTotal.toFixed(2)}
              </td>
              <td className="pl-2 pr-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ManagePanel({
  vendorOptions, setVendorOptions,
  methodOptions, setMethodOptions,
  onExpensesChanged,
}: {
  vendorOptions: string[];
  setVendorOptions: React.Dispatch<React.SetStateAction<string[]>>;
  methodOptions: string[];
  setMethodOptions: React.Dispatch<React.SetStateAction<string[]>>;
  onExpensesChanged: () => void;
}) {
  const [mergingVendor, setMergingVendor]   = useState<string | null>(null);
  const [mergingMethod, setMergingMethod]   = useState<string | null>(null);
  const [mergeInto, setMergeInto]           = useState("");
  const [busy, setBusy]                     = useState(false);
  const [err, setErr]                       = useState<string | null>(null);

  async function doMerge(type: "vendors" | "payment-methods", from: string, into: string) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/full-accounting/expense-${type}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, into }),
    });
    if (res.ok) {
      if (type === "vendors") setVendorOptions((p) => p.filter((v) => v !== from));
      else setMethodOptions((p) => p.filter((v) => v !== from));
      onExpensesChanged();
      setMergingVendor(null); setMergingMethod(null); setMergeInto("");
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Merge failed.");
    }
    setBusy(false);
  }

  async function doDelete(type: "vendors" | "payment-methods", name: string) {
    if (!confirm(`Remove "${name}" from the list? Existing expenses are not changed.`)) return;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/full-accounting/expense-${type}/merge?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      if (type === "vendors") setVendorOptions((p) => p.filter((v) => v !== name));
      else setMethodOptions((p) => p.filter((v) => v !== name));
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Delete failed.");
    }
    setBusy(false);
  }

  function ListSection({
    title, items, type, merging, setMerging,
  }: {
    title: string;
    items: string[];
    type: "vendors" | "payment-methods";
    merging: string | null;
    setMerging: (v: string | null) => void;
  }) {
    return (
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          {title} <span className="font-normal">({items.length})</span>
        </p>
        <div className="space-y-1">
          {items.length === 0 && <p className="text-xs text-gray-400 italic">No entries yet.</p>}
          {items.map((name) => (
            <div key={name}>
              <div className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={() => { setMerging(name); setMergeInto(""); setErr(null); }}
                    className="text-[11px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-500 hover:text-emerald-600 hover:border-emerald-400 transition-colors"
                  >
                    Merge →
                  </button>
                  <button
                    type="button"
                    onClick={() => doDelete(type, name)}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {merging === name && (
                <div className="ml-2 mt-1 mb-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Merge <strong>{name}</strong> into:
                  </p>
                  <select
                    value={mergeInto}
                    onChange={(e) => setMergeInto(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">— select canonical name —</option>
                    {items.filter((v) => v !== name).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!mergeInto || busy}
                      onClick={() => doMerge(type, name, mergeInto)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                    >
                      {busy ? "Merging…" : "Confirm Merge"}
                    </button>
                    <button type="button" onClick={() => setMerging(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Manage Vendors &amp; Payment Methods</p>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-8 flex-wrap">
        <ListSection title="Business Vendors" items={vendorOptions} type="vendors" merging={mergingVendor} setMerging={setMergingVendor} />
        <ListSection title="Payment Methods" items={methodOptions} type="payment-methods" merging={mergingMethod} setMerging={setMergingMethod} />
      </div>
    </div>
  );
}

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
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const formRef                   = useRef<HTMLDivElement>(null);
  const LIMIT = 100;

  const [vendorOptions, setVendorOptions]   = useState<string[]>([]);
  const [methodOptions, setMethodOptions]   = useState<string[]>([]);
  const [showManage, setShowManage]         = useState(false);
  const [view, setView]                     = useState<"transactions" | "summary">("transactions");
  const [summary, setSummary]               = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/full-accounting/expense-vendors")
      .then((r) => r.json())
      .then((j) => setVendorOptions((j.vendors ?? []).map((v: { name: string }) => v.name)));
    fetch("/api/admin/full-accounting/expense-payment-methods")
      .then((r) => r.json())
      .then((j) => setMethodOptions((j.methods ?? []).map((m: { name: string }) => m.name)));
  }, []);

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

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (from)      params.set("from", from);
      if (to)        params.set("to", to);
      if (catFilter) params.set("category", catFilter);
      const res = await fetch(`/api/admin/full-accounting/expenses/summary?${params}`);
      const json = await res.json();
      setSummary(json);
    } finally {
      setSummaryLoading(false);
    }
  }, [from, to, catFilter]);

  useEffect(() => { if (view === "summary") loadSummary(); }, [view, loadSummary]);

  function openForm() {
    // Slight delay so the form is in the DOM before scrolling
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMsg(null);
    openForm();
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
    openForm();
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

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/full-accounting/expenses/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setForm((p) => ({ ...p, receipt_url: json.url }));
      } else {
        setMsg(`Upload error: ${json.error}`);
      }
    } finally {
      setUploading(false);
    }
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
        <button onClick={() => { load(1); if (view === "summary") loadSummary(); }}
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg">
          Apply
        </button>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
          {(["transactions", "summary"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                view === v
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <button
            onClick={() => setShowManage((v) => !v)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              showManage
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
            }`}
          >
            Manage Lists
          </button>
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

      {/* Manage vendors & payment methods */}
      {showManage && (
        <ManagePanel
          vendorOptions={vendorOptions}
          setVendorOptions={setVendorOptions}
          methodOptions={methodOptions}
          setMethodOptions={setMethodOptions}
          onExpensesChanged={() => load(1)}
        />
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div ref={formRef} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
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
            <ComboProfile
              label="Vendor"
              value={form.vendor}
              onChange={(v) => setForm((p) => ({ ...p, vendor: v }))}
              options={vendorOptions}
              onAddOption={(v) => setVendorOptions((prev) => [...prev, v].sort())}
              placeholder="e.g. Temu"
            />
            <ComboProfile
              label="Payment Method"
              value={form.payment_method}
              onChange={(v) => setForm((p) => ({ ...p, payment_method: v }))}
              options={methodOptions}
              onAddOption={(v) => setMethodOptions((prev) => [...prev, v].sort())}
              placeholder="e.g. Business Debit 5344"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invoice / Receipt</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.heic,.heif,.png,.jpg,.jpeg,application/pdf,image/heic,image/heif,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }}
              />
              {form.receipt_url ? (
                <div className="flex items-center gap-2 text-sm">
                  <a href={form.receipt_url} target="_blank" rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 underline truncate max-w-[120px]">
                    View file
                  </a>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                    Replace
                  </button>
                  <button type="button" onClick={() => setForm((p) => ({ ...p, receipt_url: "" }))}
                    className="text-xs text-red-400 hover:text-red-600 shrink-0">
                    ✕
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full text-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors disabled:opacity-50 text-left">
                  {uploading ? "Uploading…" : "Upload PDF, HEIC, PNG, JPG"}
                </button>
              )}
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

      {/* Summary view */}
      {view === "summary" && (
        summaryLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <SummaryTable rows={summary.byVendor}   label="By Vendor" />
              <SummaryTable rows={summary.byMethod}   label="By Payment Method" />
            </div>
            <SummaryTable rows={summary.byCategory} label="By Category" />
          </div>
        ) : null
      )}

      {/* Transactions table */}
      {view === "transactions" && <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                  <th className="px-3 py-3 text-left">Invoice</th>
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
                    <td className="px-3 py-2.5">
                      {e.receipt_url ? (
                        <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap">
                          View ↗
                        </a>
                      ) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
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
      </div>}

      {view === "transactions" && totalPages > 1 && (
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
