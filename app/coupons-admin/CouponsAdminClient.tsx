"use client";

import { useState, useEffect, useRef } from "react";
import { EmailPreviewModal } from "@/app/custom-emails-admin/EmailPreviewModal";

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
  customer_email: string | null;
  coupon_purpose: "thank_you" | "retention" | "giveaway" | null;
  email_sent_at: string | null;
};

type CustomerResult = {
  id: string;
  customer_name: string;
  customer_email: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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

function genCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const EMPTY_CUSTOMER_FORM = {
  customerEmail: "",
  customerName: "",
  purpose: "thank_you" as "thank_you" | "retention",
  code: "",
  name: "",
  discount_type: "fixed" as "fixed" | "percent",
  discount_value: "",
  send_at: "",
};

const EMPTY_GIVEAWAY_FORM = {
  recipientName: "",
  recipientEmail: "",
  discount_type: "fixed" as "fixed" | "percent",
  discount_value: "",
  code: "",
};

// ── Customer search combobox ──────────────────────────────────────────────────

function CustomerSearchField({
  value,
  displayName,
  onSelect,
  onClear,
}: {
  value: string;
  displayName: string;
  onSelect: (email: string, name: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        setResults((data.customers ?? []).filter((c: CustomerResult) => c.customer_email));
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function select(c: CustomerResult) {
    onSelect(c.customer_email, c.customer_name);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName || value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{value}</p>
        </div>
        <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0">✕</button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder="Search by name or email…"
        required
        className={inputCls}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => select(c)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white">{c.customer_name || "—"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.customer_email}</p>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2.5">
          <p className="text-sm text-gray-400">No customers found</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [customerSubmitting, setCustomerSubmitting] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [showGiveawayForm, setShowGiveawayForm] = useState(false);
  const [giveawayForm, setGiveawayForm] = useState(EMPTY_GIVEAWAY_FORM);
  const [giveawaySubmitting, setGiveawaySubmitting] = useState(false);
  const [giveawayPreviewing, setGiveawayPreviewing] = useState(false);
  const [giveawayError, setGiveawayError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [resendTarget, setResendTarget] = useState<Campaign | null>(null);
  const [resendSending, setResendSending] = useState<string | null>(null); // type being sent
  const [resendPreviewing, setResendPreviewing] = useState<string | null>(null); // type being previewed

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function sendResend(type: string) {
    if (!resendTarget) return;
    setResendSending(type);
    try {
      const res = await fetch(`/api/admin/coupons/${resendTarget.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const { email_sent_at } = await res.json();
        setCampaigns((prev) => prev.map((c) => c.id === resendTarget!.id ? { ...c, email_sent_at } : c));
        showToast(`Email sent to ${resendTarget.customer_email}`);
        setResendTarget(null);
      } else {
        const { error } = await res.json().catch(() => ({ error: "Failed to send." }));
        showToast(`Error: ${error}`);
      }
    } finally {
      setResendSending(null);
    }
  }

  async function previewResend(type: string) {
    if (!resendTarget) return;
    setResendPreviewing(type);
    try {
      const reminderNumber = type === "reminder1" ? 1 : type === "reminder2" ? 2 : null;
      const res = await fetch("/api/admin/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: resendTarget.coupon_purpose,
          discount_type: resendTarget.discount_type === "tiered" ? "fixed" : resendTarget.discount_type,
          discount_value: resendTarget.discount_value,
          coupon_code: resendTarget.code,
          reminder_number: reminderNumber,
        }),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
    } finally {
      setResendPreviewing(null);
    }
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

  async function handleCustomerCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCustomerSubmitting(true);
    setCustomerError(null);
    try {
      const code = customerForm.code.trim().toUpperCase() || genCode();
      const purposeLabel = customerForm.purpose === "thank_you" ? "Thank You" : "Retention";
      const name = `${purposeLabel} — ${customerForm.customerName || customerForm.customerEmail}`;
      const scheduledSendAt = customerForm.send_at
        ? new Date(customerForm.send_at).toISOString()
        : null;

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          discount_type: customerForm.discount_type,
          discount_value: Number(customerForm.discount_value) || null,
          active: true,
          starts_at: null,
          new_customers_only: false,
          minimum_order_amount: null,
          max_redemptions_per_customer: 1,
          max_total_redemptions: 1,
          notes: null,
          customer_email: customerForm.customerEmail,
          coupon_purpose: customerForm.purpose,
          scheduled_send_at: scheduledSendAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomerError(data.error ?? "Something went wrong.");
      } else {
        setCampaigns((prev) => [{ ...data, redemption_count: 0 }, ...prev]);
        setCustomerForm(EMPTY_CUSTOMER_FORM);
        setShowCustomerForm(false);
        const isScheduled = scheduledSendAt && new Date(scheduledSendAt) > new Date();
        showToast(isScheduled ? `Coupon created. Email scheduled for ${fmtDateTime(scheduledSendAt!)}` : "Coupon created & email sent.");
      }
    } finally {
      setCustomerSubmitting(false);
    }
  }

  async function handleGiveaway(e: React.FormEvent) {
    e.preventDefault();
    setGiveawaySubmitting(true);
    setGiveawayError(null);
    try {
      const code = giveawayForm.code.trim().toUpperCase() || genCode();
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: `Giveaway — ${giveawayForm.recipientName.trim() || giveawayForm.recipientEmail}`,
          discount_type: giveawayForm.discount_type,
          discount_value: Number(giveawayForm.discount_value) || null,
          active: true,
          starts_at: null,
          ends_at: null,
          never_expires: true,
          new_customers_only: false,
          minimum_order_amount: null,
          max_redemptions_per_customer: 1,
          max_total_redemptions: 1,
          notes: "Giveaway — never expires",
          customer_email: giveawayForm.recipientEmail.trim().toLowerCase(),
          coupon_purpose: "giveaway",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGiveawayError(data.error ?? "Something went wrong.");
      } else {
        setCampaigns((prev) => [{ ...data, redemption_count: 0 }, ...prev]);
        setGiveawayForm({ ...EMPTY_GIVEAWAY_FORM, code: genCode() });
        setShowGiveawayForm(false);
        showToast("Giveaway coupon created & email sent.");
      }
    } finally {
      setGiveawaySubmitting(false);
    }
  }

  async function handleGiveawayPreview() {
    setGiveawayPreviewing(true);
    try {
      const res = await fetch("/api/admin/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "giveaway",
          discount_type: giveawayForm.discount_type,
          discount_value: Number(giveawayForm.discount_value) || null,
          coupon_code: giveawayForm.code || undefined,
          reminder_number: null,
        }),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
    } finally {
      setGiveawayPreviewing(false);
    }
  }

  async function handlePreview(reminderNumber?: 1 | 2) {
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: customerForm.purpose,
          discount_type: customerForm.discount_type,
          discount_value: Number(customerForm.discount_value) || null,
          coupon_code: customerForm.code || undefined,
          reminder_number: reminderNumber ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
    } finally {
      setPreviewing(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Coupon Campaigns</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Seasonal and promotional discount codes</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { setShowRedeem((v) => !v); setRedeemResult(null); setShowForm(false); setShowCustomerForm(false); setShowGiveawayForm(false); }}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {showRedeem ? "Cancel" : "Manual Redemption"}
          </button>
          <button
            type="button"
            onClick={() => { setShowCustomerForm((v) => !v); setCustomerError(null); setShowForm(false); setShowRedeem(false); setShowGiveawayForm(false); if (!showCustomerForm) setCustomerForm({ ...EMPTY_CUSTOMER_FORM, code: genCode() }); }}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
          >
            {showCustomerForm ? "Cancel" : "Customer Coupon"}
          </button>
          <button
            type="button"
            onClick={() => { setShowGiveawayForm((v) => !v); setGiveawayError(null); setShowForm(false); setShowRedeem(false); setShowCustomerForm(false); if (!showGiveawayForm) setGiveawayForm({ ...EMPTY_GIVEAWAY_FORM, code: genCode() }); }}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            {showGiveawayForm ? "Cancel" : "Giveaway"}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setError(null); setShowRedeem(false); setShowCustomerForm(false); setShowGiveawayForm(false); }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Customer coupon form */}
      {showCustomerForm && (
        <form onSubmit={handleCustomerCoupon} className="bg-white dark:bg-gray-900 rounded-xl border border-violet-200 dark:border-violet-800 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Personal Customer Coupon</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Creates a one-time coupon tied to a specific customer. Email is sent immediately or at the scheduled time.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer">
              <CustomerSearchField
                value={customerForm.customerEmail}
                displayName={customerForm.customerName}
                onSelect={(email, name) => setCustomerForm((f) => ({ ...f, customerEmail: email, customerName: name }))}
                onClear={() => setCustomerForm((f) => ({ ...f, customerEmail: "", customerName: "" }))}
              />
            </Field>
            <Field label="Purpose">
              <select
                value={customerForm.purpose}
                onChange={(e) => setCustomerForm((f) => ({ ...f, purpose: e.target.value as "thank_you" | "retention" }))}
                className={inputCls}
              >
                <option value="thank_you">Thank You Note</option>
                <option value="retention">Retention Encourage</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Discount type">
              <select
                value={customerForm.discount_type}
                onChange={(e) => setCustomerForm((f) => ({ ...f, discount_type: e.target.value as "fixed" | "percent" }))}
                className={inputCls}
              >
                <option value="fixed">Fixed ($)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </Field>
            <Field label={customerForm.discount_type === "percent" ? "Percentage off" : "Amount off ($)"}>
              <input
                type="number"
                min={1}
                value={customerForm.discount_value}
                onChange={(e) => setCustomerForm((f) => ({ ...f, discount_value: e.target.value }))}
                required
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">Coupon is valid for 3 months. Reminder emails sent at 1 and 2 months if unused.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Coupon code (auto-generated if blank)">
              <input
                value={customerForm.code}
                onChange={(e) => setCustomerForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder={customerForm.code || "Leave blank to auto-generate"}
                className={inputCls}
              />
            </Field>
            <Field label="Schedule send (optional — blank = send now)">
              <input
                type="datetime-local"
                value={customerForm.send_at}
                onChange={(e) => setCustomerForm((f) => ({ ...f, send_at: e.target.value }))}
                className={inputCls}
              />
            </Field>
          </div>

          {customerError && <p className="text-sm text-red-600 dark:text-red-400">{customerError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={customerSubmitting}
              className="text-sm font-medium px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors"
            >
              {customerSubmitting
                ? "Creating…"
                : customerForm.send_at && new Date(customerForm.send_at) > new Date()
                ? "Create & Schedule Email"
                : "Create & Send Email"}
            </button>
            <button
              type="button"
              disabled={previewing}
              onClick={() => handlePreview()}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {previewing ? "Loading…" : "Preview Email"}
            </button>
            <button
              type="button"
              disabled={previewing}
              onClick={() => handlePreview(1)}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Preview Reminder 1
            </button>
            <button
              type="button"
              disabled={previewing}
              onClick={() => handlePreview(2)}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
            >
              Preview Reminder 2
            </button>
          </div>
        </form>
      )}

      {/* Giveaway form */}
      {showGiveawayForm && (
        <form onSubmit={handleGiveaway} className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Giveaway Coupon</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Single-use, never-expires coupon sent to any email — for contests, giveaways, or gifting to non-clients.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Recipient email">
              <input
                type="email"
                value={giveawayForm.recipientEmail}
                onChange={(e) => setGiveawayForm((f) => ({ ...f, recipientEmail: e.target.value }))}
                placeholder="winner@example.com"
                required
                className={inputCls}
              />
            </Field>
            <Field label="Recipient name (optional)">
              <input
                type="text"
                value={giveawayForm.recipientName}
                onChange={(e) => setGiveawayForm((f) => ({ ...f, recipientName: e.target.value }))}
                placeholder="e.g. Sarah"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Discount type">
              <select
                value={giveawayForm.discount_type}
                onChange={(e) => setGiveawayForm((f) => ({ ...f, discount_type: e.target.value as "fixed" | "percent" }))}
                className={inputCls}
              >
                <option value="fixed">Fixed ($)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </Field>
            <Field label={giveawayForm.discount_type === "percent" ? "Percentage off" : "Amount off ($)"}>
              <input
                type="number"
                min={1}
                value={giveawayForm.discount_value}
                onChange={(e) => setGiveawayForm((f) => ({ ...f, discount_value: e.target.value }))}
                required
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Coupon code (auto-generated if blank)">
            <input
              value={giveawayForm.code}
              onChange={(e) => setGiveawayForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder={giveawayForm.code || "Leave blank to auto-generate"}
              className={`${inputCls} font-mono uppercase tracking-widest`}
            />
          </Field>

          <p className="text-xs text-amber-700 dark:text-amber-400 -mt-2">Never expires · Single use · Email sent immediately</p>

          {giveawayError && <p className="text-sm text-red-600 dark:text-red-400">{giveawayError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={giveawaySubmitting}
              className="text-sm font-medium px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
            >
              {giveawaySubmitting ? "Creating…" : "Create & Send"}
            </button>
            <button
              type="button"
              disabled={giveawayPreviewing}
              onClick={handleGiveawayPreview}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {giveawayPreviewing ? "Loading…" : "Preview Email"}
            </button>
          </div>
        </form>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Campaign</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Campaign name">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Black Friday 2025" required className={inputCls} />
            </Field>
            <Field label="Coupon code">
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="BLACKFRI25" required className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Start date (optional)">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="End date (optional)">
              <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Resend email picker modal */}
      {resendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Send Email</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{resendTarget.customer_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setResendTarget(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none mt-0.5"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {([
                { type: "initial", label: "Initial email", desc: resendTarget.coupon_purpose === "thank_you" ? "Thank you + coupon code" : resendTarget.coupon_purpose === "giveaway" ? "Giveaway winner + coupon code" : "Retention + coupon code" },
                { type: "reminder1", label: "Reminder", desc: "Gentle nudge — coupon still valid" },
                { type: "reminder2", label: "Expiring soon", desc: "Last chance — expires soon" },
              ] as const).map(({ type, label, desc }) => (
                <div key={type} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={resendPreviewing === type}
                    onClick={() => previewResend(type)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {resendPreviewing === type ? "…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={!!resendSending}
                    onClick={() => sendResend(type)}
                    className="text-xs px-2.5 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors shrink-0"
                  >
                    {resendSending === type ? "Sending…" : "Send"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      {previewHtml && (
        <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} maxWidth="max-w-5xl" />
      )}

      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No campaigns yet.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
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
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {c.new_customers_only && <span className="text-xs text-amber-600 dark:text-amber-400">New customers only</span>}
                      {c.customer_email && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          c.coupon_purpose === "giveaway"
                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                        }`}>
                          {c.coupon_purpose === "giveaway" ? "Giveaway" : c.coupon_purpose === "thank_you" ? "Thank You" : "Retention"} · {c.customer_email}
                        </span>
                      )}
                      {c.customer_email && c.email_sent_at && new Date(c.email_sent_at) > new Date() && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                          Scheduled {fmtDateTime(c.email_sent_at)}
                        </span>
                      )}
                      {c.customer_email && c.email_sent_at && new Date(c.email_sent_at) <= new Date() && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          Sent {fmtDateTime(c.email_sent_at)}
                        </span>
                      )}
                      {c.customer_email && !c.email_sent_at && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          Email not sent
                        </span>
                      )}
                      {c.customer_email && c.redemption_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-medium">
                          Used
                        </span>
                      )}
                      {c.customer_email && c.email_sent_at && c.redemption_count === 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          Unused
                        </span>
                      )}
                    </div>
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
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                      {c.customer_email && c.coupon_purpose && (
                        <button
                          type="button"
                          onClick={() => setResendTarget(c)}
                          className="text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                        >
                          {c.email_sent_at ? "Resend email" : "Send now"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
