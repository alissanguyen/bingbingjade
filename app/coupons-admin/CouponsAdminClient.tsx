"use client";

import { useState } from "react";

export type Campaign = {
  id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percent" | "tiered";
  discount_value: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  new_customers_only: boolean;
  minimum_order_amount: number | null;
  max_redemptions_per_customer: number;
  max_total_redemptions: number | null;
  notes: string | null;
  created_at: string;
  redemption_count: number;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function discountLabel(c: Campaign) {
  if (c.discount_type === "tiered") return "$10/$20 tiered";
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  return `$${c.discount_value} off`;
}

const EMPTY_FORM = {
  code: "",
  name: "",
  discount_type: "fixed" as "fixed" | "percent" | "tiered",
  discount_value: "",
  active: true,
  starts_at: "",
  ends_at: "",
  new_customers_only: false,
  minimum_order_amount: "",
  max_redemptions_per_customer: "1",
  max_total_redemptions: "",
  notes: "",
};

const EMPTY_REDEEM = { code: "", customerEmail: "", orderRef: "" };

export function CouponsAdminClient({ campaigns: initial }: { campaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemForm, setRedeemForm] = useState(EMPTY_REDEEM);
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleActive(campaign: Campaign) {
    const res = await fetch(`/api/admin/coupons/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !campaign.active }),
    });
    if (res.ok) {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, active: !c.active } : c))
      );
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setRedeemSubmitting(true);
    setRedeemResult(null);
    try {
      const res = await fetch("/api/admin/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: redeemForm.code,
          customerEmail: redeemForm.customerEmail,
          orderRef: redeemForm.orderRef || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemResult({ ok: true, message: data.detail });
        setRedeemForm(EMPTY_REDEEM);
      } else {
        setRedeemResult({ ok: false, message: data.error ?? "Something went wrong." });
      }
    } finally {
      setRedeemSubmitting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          discount_type: form.discount_type,
          discount_value: form.discount_type === "tiered" ? null : (Number(form.discount_value) || null),
          active: form.active,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          new_customers_only: form.new_customers_only,
          minimum_order_amount: Number(form.minimum_order_amount) || null,
          max_redemptions_per_customer: Number(form.max_redemptions_per_customer) || 1,
          max_total_redemptions: Number(form.max_total_redemptions) || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setCampaigns((prev) => [{ ...data, redemption_count: 0 }, ...prev]);
        setForm(EMPTY_FORM);
        setShowForm(false);
        showToast("Campaign created.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Coupon Campaigns</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Seasonal and promotional discount codes</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowRedeem((v) => !v); setRedeemResult(null); }}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {showRedeem ? "Cancel" : "Manual Redemption"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setError(null); }}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            {showForm ? "Cancel" : "New Campaign"}
          </button>
        </div>
      </div>

      {/* Manual redemption form */}
      {showRedeem && (
        <form onSubmit={handleRedeem} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Manual Redemption</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Mark a subscriber coupon, campaign code, or referral code as used for Zelle / wire-transfer orders.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Coupon / referral code">
              <input
                value={redeemForm.code}
                onChange={(e) => setRedeemForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. ABC123 or BLACKFRI25"
                required
                className={inputCls}
              />
            </Field>
            <Field label="Customer email">
              <input
                type="email"
                value={redeemForm.customerEmail}
                onChange={(e) => setRedeemForm((f) => ({ ...f, customerEmail: e.target.value }))}
                placeholder="customer@example.com"
                required
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Order reference (optional)">
            <input
              value={redeemForm.orderRef}
              onChange={(e) => setRedeemForm((f) => ({ ...f, orderRef: e.target.value }))}
              placeholder="e.g. Zelle order Jan 15"
              className={inputCls}
            />
          </Field>
          {redeemResult && (
            <p className={`text-sm rounded-lg px-3 py-2 ${redeemResult.ok ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"}`}>
              {redeemResult.message}
            </p>
          )}
          <button type="submit" disabled={redeemSubmitting} className="text-sm font-medium px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 disabled:opacity-50 transition-colors">
            {redeemSubmitting ? "Marking…" : "Mark as Used"}
          </button>
        </form>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Campaign</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign name">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Black Friday 2025" required className={inputCls} />
            </Field>
            <Field label="Coupon code">
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BLACKFRI25" required className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount type">
              <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as "fixed" | "percent" | "tiered" }))} className={inputCls}>
                <option value="fixed">Fixed ($)</option>
                <option value="percent">Percent (%)</option>
                <option value="tiered">Tiered ($10/$20)</option>
              </select>
            </Field>
            {form.discount_type !== "tiered" && (
              <Field label={form.discount_type === "percent" ? "Percentage off" : "Amount off ($)"}>
                <input type="number" min={1} value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} required className={inputCls} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date (optional)">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="End date (optional)">
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Min order amount ($)">
              <input type="number" min={0} value={form.minimum_order_amount} onChange={(e) => setForm((f) => ({ ...f, minimum_order_amount: e.target.value }))} placeholder="None" className={inputCls} />
            </Field>
            <Field label="Max uses per customer">
              <input type="number" min={1} value={form.max_redemptions_per_customer} onChange={(e) => setForm((f) => ({ ...f, max_redemptions_per_customer: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Global max uses">
              <input type="number" min={1} value={form.max_total_redemptions} onChange={(e) => setForm((f) => ({ ...f, max_total_redemptions: e.target.value }))} placeholder="Unlimited" className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.new_customers_only} onChange={(e) => setForm((f) => ({ ...f, new_customers_only: e.target.checked }))} className="rounded border-gray-300" />
              New customers only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded border-gray-300" />
              Active immediately
            </label>
          </div>

          <Field label="Internal notes (optional)">
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Thanksgiving campaign 2025" className={inputCls} />
          </Field>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className="text-sm font-medium px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors">
            {submitting ? "Creating…" : "Create Campaign"}
          </button>
        </form>
      )}

      {/* Campaigns table */}
      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No campaigns yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Code / Name</th>
                <th className="text-left px-4 py-3 font-medium">Discount</th>
                <th className="text-left px-4 py-3 font-medium">Window</th>
                <th className="text-center px-4 py-3 font-medium">Uses</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {campaigns.map((c) => (
                <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                  <td className="px-5 py-4">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{c.code}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.name}</p>
                    {c.new_customers_only && <span className="text-xs text-amber-600 dark:text-amber-400">New customers only</span>}
                  </td>
                  <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{discountLabel(c)}</td>
                  <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                    {c.starts_at ? fmt(c.starts_at) : "—"}{" "}→{" "}
                    {c.ends_at ? fmt(c.ends_at) : "No expiry"}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 dark:text-gray-300">
                    {c.redemption_count}
                    {c.max_total_redemptions != null && (
                      <span className="text-gray-400"> / {c.max_total_redemptions}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}
