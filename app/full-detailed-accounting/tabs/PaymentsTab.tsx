"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: string;
  order_id: string | null;
  bbj_order_code: string | null;
  payment_provider: string;
  payment_type: string;
  provider_transaction_id: string | null;
  provider_receipt_id: string | null;
  provider_invoice_id: string | null;
  amount_paid_usd: number;
  currency: string;
  payment_fee_usd: number;
  net_received_usd: number;
  payment_date: string;
  payment_status: string;
  proof_url: string | null;
  notes: string | null;
  orders: {
    id: string;
    order_number: string | null;
    customer_name: string | null;
    customer_email: string | null;
    amount_total: number | null;
    order_status: string | null;
  } | null;
}

interface OrderSummary {
  order_id: string;
  bbj_order_code: string | null;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_total_usd: number | null;
  order_status: string | null;
  total_paid: number;
  total_fees: number;
  total_net: number;
  amount_due: number | null;
  payment_status: string;
  providers: string[];
  payments: PaymentRow[];
}

interface PaymentFormData {
  bbj_order_code: string;
  order_id: string;
  payment_provider: string;
  payment_type: string;
  amount_paid_usd: string;
  currency: string;
  payment_fee_usd: string;
  net_received_usd: string;
  payment_date: string;
  payment_status: string;
  provider_transaction_id: string;
  provider_receipt_id: string;
  provider_invoice_id: string;
  proof_url: string;
  notes: string;
}

const PROVIDERS = ["stripe", "paypal", "zelle", "bank_transfer", "cash", "other"];
const PAY_TYPES = ["checkout", "invoice", "manual", "deposit", "balance_payment", "partial_payment", "refund"];
const PAY_STATUSES = ["pending", "paid", "partially_refunded", "refunded", "failed"];

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe", paypal: "PayPal", zelle: "Zelle",
  bank_transfer: "Bank Transfer", cash: "Cash", other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  paid:               "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  partial:            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unpaid:             "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  no_payments:        "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  pending:            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  partially_refunded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  refunded:           "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  failed:             "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const EMPTY_FORM: PaymentFormData = {
  bbj_order_code: "", order_id: "",
  payment_provider: "zelle", payment_type: "manual",
  amount_paid_usd: "", currency: "USD",
  payment_fee_usd: "0", net_received_usd: "",
  payment_date: new Date().toISOString().slice(0, 16),
  payment_status: "paid",
  provider_transaction_id: "", provider_receipt_id: "", provider_invoice_id: "",
  proof_url: "", notes: "",
};

function $$(n: number | null | undefined, blank = "—") {
  if (n == null) return blank;
  return n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    stripe: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    paypal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    zelle:  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    bank_transfer: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    cash:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    other:  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${colors[provider] ?? colors.other}`}>
      {PROVIDER_LABELS[provider] ?? provider}
    </span>
  );
}

// ── Payment Form Modal ────────────────────────────────────────────────────────

function PaymentModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<PaymentFormData> & { id?: string };
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PaymentFormData>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const isEditing = !!initial.id;

  function set(k: keyof PaymentFormData, v: string) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Auto-compute net when amount or fee changes
      if ((k === "amount_paid_usd" || k === "payment_fee_usd") && !isEditing) {
        const amount = parseFloat(next.amount_paid_usd) || 0;
        const fee    = parseFloat(next.payment_fee_usd) || 0;
        next.net_received_usd = (amount - fee).toFixed(2);
      }
      // Zelle has no fee by default
      if (k === "payment_provider" && v === "zelle") {
        next.payment_fee_usd = "0";
        const amount = parseFloat(next.amount_paid_usd) || 0;
        next.net_received_usd = amount.toFixed(2);
      }
      return next;
    });
  }

  async function lookupOrder() {
    if (!form.bbj_order_code.trim()) return;
    setLookupMsg("Looking up…");
    try {
      const res = await fetch(`/api/admin/full-accounting/payments?search=${encodeURIComponent(form.bbj_order_code.trim())}&limit=1`);
      const json = await res.json();
      const summary: OrderSummary | undefined = json.orderSummaries?.[0];
      if (summary?.order_id) {
        setForm(prev => ({
          ...prev,
          order_id: summary.order_id,
          bbj_order_code: summary.order_number ?? prev.bbj_order_code,
        }));
        setLookupMsg(`Found: ${summary.customer_name ?? summary.order_number} — ${$$(summary.amount_total_usd)} total`);
      } else {
        setLookupMsg("Order not found — payment will be saved without an order link.");
      }
    } catch {
      setLookupMsg("Lookup failed");
    }
  }

  async function handleSave() {
    if (!form.amount_paid_usd || parseFloat(form.amount_paid_usd) <= 0) {
      setError("Amount is required");
      return;
    }
    if (!form.payment_date) {
      setError("Payment date is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        order_id:               form.order_id || null,
        bbj_order_code:         form.bbj_order_code || null,
        payment_provider:       form.payment_provider,
        payment_type:           form.payment_type,
        amount_paid_usd:        parseFloat(form.amount_paid_usd),
        currency:               form.currency || "USD",
        payment_fee_usd:        parseFloat(form.payment_fee_usd) || 0,
        net_received_usd:       parseFloat(form.net_received_usd) || (parseFloat(form.amount_paid_usd) - (parseFloat(form.payment_fee_usd) || 0)),
        payment_date:           form.payment_date,
        payment_status:         form.payment_status,
        provider_transaction_id: form.provider_transaction_id || null,
        provider_receipt_id:    form.provider_receipt_id || null,
        provider_invoice_id:    form.provider_invoice_id || null,
        proof_url:              form.proof_url || null,
        notes:                  form.notes || null,
      };

      const url    = isEditing ? `/api/admin/full-accounting/payments/${initial.id}` : "/api/admin/full-accounting/payments";
      const method = isEditing ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json   = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed"); return; }
      onSave();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "Edit Payment" : "Add Payment"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Order lookup */}
          <div>
            <label className={labelClass}>BBJ Order Code</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="BBJ-0042"
                value={form.bbj_order_code}
                onChange={e => set("bbj_order_code", e.target.value.toUpperCase())}
              />
              <button
                type="button"
                onClick={lookupOrder}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 whitespace-nowrap"
              >
                Look up
              </button>
            </div>
            {lookupMsg && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{lookupMsg}</p>}
          </div>

          {/* Provider + type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Provider <span className="text-red-400">*</span></label>
              <select className={inputClass} value={form.payment_provider} onChange={e => set("payment_provider", e.target.value)}>
                {PROVIDERS.map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Type <span className="text-red-400">*</span></label>
              <select className={inputClass} value={form.payment_type} onChange={e => set("payment_type", e.target.value)}>
                {PAY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          {/* Amount + fee + net */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Amount Paid (USD) <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" className={`${inputClass} pl-7`}
                  value={form.amount_paid_usd} onChange={e => set("amount_paid_usd", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Fee (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" className={`${inputClass} pl-7`}
                  value={form.payment_fee_usd} onChange={e => set("payment_fee_usd", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Net Received (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" className={`${inputClass} pl-7`}
                  value={form.net_received_usd} onChange={e => set("net_received_usd", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Date + status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Payment Date <span className="text-red-400">*</span></label>
              <input type="datetime-local" className={inputClass}
                value={form.payment_date} onChange={e => set("payment_date", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.payment_status} onChange={e => set("payment_status", e.target.value)}>
                {PAY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          {/* Provider IDs */}
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Transaction / Confirmation ID</label>
              <input className={inputClass} placeholder="PI_xxxx / Zelle conf # / PayPal txn"
                value={form.provider_transaction_id} onChange={e => set("provider_transaction_id", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Receipt ID / URL</label>
                <input className={inputClass} placeholder="Stripe receipt URL"
                  value={form.provider_receipt_id} onChange={e => set("provider_receipt_id", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Invoice ID</label>
                <input className={inputClass} placeholder="PayPal invoice ID"
                  value={form.provider_invoice_id} onChange={e => set("provider_invoice_id", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Proof + notes */}
          <div>
            <label className={labelClass}>Proof URL (screenshot / receipt)</label>
            <input className={inputClass} placeholder="https://..."
              value={form.proof_url} onChange={e => set("proof_url", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={`${inputClass} resize-y`} rows={2}
              value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
          >
            {saving ? "Saving…" : isEditing ? "Update" : "Add Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function PaymentsTab() {
  const [payments, setPayments]       = useState<PaymentRow[]>([]);
  const [summaries, setSummaries]     = useState<OrderSummary[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [provider, setProvider]       = useState("");
  const [expandedOrder, setExpanded]  = useState<string | null>(null);
  const [modal, setModal]             = useState<null | { initial: Partial<PaymentFormData> & { id?: string } }>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const LIMIT = 50;

  const load = useCallback(async (p = 1, s = search, prov = provider) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s.trim().length >= 2) params.set("search", s.trim());
      if (prov) params.set("provider", prov);
      const res = await fetch(`/api/admin/full-accounting/payments?${params}`);
      const json = await res.json();
      setPayments(json.payments ?? []);
      setSummaries(json.orderSummaries ?? []);
      setTotal(json.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [search, provider]);

  useEffect(() => { load(1); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment? This cannot be undone. Stripe payments will be re-added on next sync.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/full-accounting/payments/${id}`, { method: "DELETE" });
      load(page);
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(p: PaymentRow) {
    setModal({
      initial: {
        id: p.id,
        order_id: p.order_id ?? "",
        bbj_order_code: p.bbj_order_code ?? "",
        payment_provider: p.payment_provider,
        payment_type: p.payment_type,
        amount_paid_usd: String(p.amount_paid_usd),
        currency: p.currency,
        payment_fee_usd: String(p.payment_fee_usd),
        net_received_usd: String(p.net_received_usd),
        payment_date: p.payment_date?.slice(0, 16) ?? "",
        payment_status: p.payment_status,
        provider_transaction_id: p.provider_transaction_id ?? "",
        provider_receipt_id: p.provider_receipt_id ?? "",
        provider_invoice_id: p.provider_invoice_id ?? "",
        proof_url: p.proof_url ?? "",
        notes: p.notes ?? "",
      },
    });
  }

  const totalPages = Math.ceil(total / LIMIT);

  // Group view: show order summaries with expandable payment rows
  // Flat view: when search has results grouped naturally in summaries
  const showGrouped = summaries.length > 0;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Search by BBJ code, Stripe PI, PayPal invoice, Zelle conf…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1, search, provider)}
          />
        </div>
        <select
          className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none"
          value={provider}
          onChange={e => { setProvider(e.target.value); load(1, search, e.target.value); }}
        >
          <option value="">All providers</option>
          {PROVIDERS.map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
        </select>
        <button onClick={() => load(1, search, provider)}
          className="px-3 py-2 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors">
          Search
        </button>
        <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">{total} payments</span>
        <button
          onClick={() => setModal({ initial: {} })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          Add Payment
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No payments found</div>
        ) : showGrouped ? (
          /* Grouped by order */
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {summaries.map(s => (
              <div key={s.order_id || s.bbj_order_code}>
                {/* Order summary row */}
                <button
                  onClick={() => setExpanded(prev => prev === (s.order_id || s.bbj_order_code) ? null : (s.order_id || s.bbj_order_code))}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
                >
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expandedOrder === (s.order_id || s.bbj_order_code) ? "rotate-90" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="m9 18 6-6-6-6" />
                  </svg>
                  <div className="font-mono font-semibold text-gray-900 dark:text-gray-100 text-sm w-24 shrink-0">
                    {s.order_number ?? s.bbj_order_code ?? "Unlinked"}
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {s.customer_name ?? s.customer_email ?? "—"}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{$$(s.amount_total_usd)}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">{$$(s.total_paid)} paid</span>
                    {s.amount_due != null && Math.abs(s.amount_due) > 0.01 && (
                      <span className="text-amber-600 dark:text-amber-400">{$$(s.amount_due)} due</span>
                    )}
                    {s.providers.map(p => <ProviderBadge key={p} provider={p} />)}
                    <StatusBadge status={s.payment_status} />
                  </div>
                </button>

                {/* Expanded payment rows */}
                {expandedOrder === (s.order_id || s.bbj_order_code) && (
                  <div className="bg-gray-50 dark:bg-gray-800/40 divide-y divide-gray-100 dark:divide-gray-800/50">
                    {/* Add payment for this order */}
                    <div className="px-12 py-2">
                      <button
                        onClick={() => setModal({ initial: { bbj_order_code: s.order_number ?? s.bbj_order_code ?? "", order_id: s.order_id } })}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        + Add payment for this order
                      </button>
                    </div>
                    {(s.payments as PaymentRow[]).map(p => (
                      <div key={p.id} className="flex items-center gap-3 px-12 py-2.5 text-xs">
                        <ProviderBadge provider={p.payment_provider} />
                        <span className="text-gray-500 dark:text-gray-400 capitalize">{p.payment_type.replace(/_/g, " ")}</span>
                        <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{$$(Number(p.amount_paid_usd))}</span>
                        {Number(p.payment_fee_usd) > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">fee {$$(Number(p.payment_fee_usd))}</span>
                        )}
                        <span className="text-gray-500">{p.payment_date?.slice(0, 10)}</span>
                        <StatusBadge status={p.payment_status} />
                        {p.provider_transaction_id && (
                          <span className="text-gray-400 font-mono truncate max-w-[120px]" title={p.provider_transaction_id}>
                            {p.provider_transaction_id.slice(0, 16)}…
                          </span>
                        )}
                        {p.proof_url && (
                          <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline">proof</a>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Edit</button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            className="text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            {deleting === p.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Flat list (no search) */
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                  {["BBJ Code", "Provider", "Type", "Amount", "Fee", "Net", "Date", "Status", "TXN ID", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="pl-4 pr-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                      {p.bbj_order_code ?? <span className="text-gray-400">unlinked</span>}
                    </td>
                    <td className="px-3 py-2"><ProviderBadge provider={p.payment_provider} /></td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{p.payment_type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-gray-900 dark:text-gray-100">{$$(Number(p.amount_paid_usd))}</td>
                    <td className="px-3 py-2 tabular-nums text-amber-600 dark:text-amber-400">
                      {Number(p.payment_fee_usd) > 0 ? $$(Number(p.payment_fee_usd)) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-400">{$$(Number(p.net_received_usd))}</td>
                    <td className="px-3 py-2 text-gray-500">{p.payment_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.payment_status} /></td>
                    <td className="px-3 py-2 font-mono text-gray-400 max-w-[100px] truncate" title={p.provider_transaction_id ?? ""}>
                      {p.provider_transaction_id ? p.provider_transaction_id.slice(0, 14) + "…" : "—"}
                    </td>
                    <td className="pr-4 pl-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Edit</button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deleting === p.id ? "…" : "Delete"}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
            Next →
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Stripe payments are auto-populated on Sync. Manual entries (Zelle, PayPal, cash) can be added freely.
        Zelle fee defaults to $0. Search by BBJ code, Stripe receipt ID, PayPal invoice ID, or Zelle confirmation.
      </p>

      {modal && (
        <PaymentModal
          initial={modal.initial}
          onSave={() => { setModal(null); load(page); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
