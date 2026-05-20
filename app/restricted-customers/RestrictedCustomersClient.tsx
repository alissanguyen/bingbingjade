"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerRestriction {
  id: string;
  customer_id: string | null;
  name: string | null;
  email: string | null;
  normalized_email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  reason: string | null;
  internal_notes: string | null;
  status: "active" | "inactive";
  severity: "blocked" | "review";
  created_at: string;
  updated_at: string;
  customers?: { id: string; customer_name: string; customer_email: string } | null;
}

interface BlockedAttempt {
  id: string;
  restriction_id: string | null;
  matched_signals: string[] | null;
  attempted_customer: Record<string, unknown> | null;
  cart_snapshot: Record<string, unknown> | null;
  created_at: string;
}

type FormState = {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  reason: string;
  internal_notes: string;
  status: "active" | "inactive";
  severity: "blocked" | "review";
};

const BLANK_FORM: FormState = {
  customer_id: "", name: "", email: "", phone: "",
  address_line1: "", address_line2: "", city: "", state: "",
  postal_code: "", country: "US", reason: "",
  internal_notes: "", status: "active", severity: "blocked",
};

const REASONS = [
  "expectation_mismatch",
  "chargeback_dispute_risk",
  "abusive_communication",
  "repeated_failed_sourcing",
  "policy_abuse",
  "manual_admin_review",
  "other",
];

const REASON_LABELS: Record<string, string> = {
  expectation_mismatch:     "Expectation Mismatch",
  chargeback_dispute_risk:  "Chargeback / Dispute Risk",
  abusive_communication:    "Abusive Communication",
  repeated_failed_sourcing: "Repeated Failed Sourcing Process",
  policy_abuse:             "Policy Abuse",
  manual_admin_review:      "Manual Admin Review",
  other:                    "Other",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      status === "active"
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    }`}>
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      severity === "blocked"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    }`}>
      {severity === "blocked" ? "Blocked" : "Review"}
    </span>
  );
}

// ── Form Component ────────────────────────────────────────────────────────────

function RestrictionForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input value={form.name} onChange={set("name")} placeholder="Full name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={set("email")} placeholder="customer@example.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Address Line 1</label>
          <input value={form.address_line1} onChange={set("address_line1")} placeholder="123 Main St" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Address Line 2</label>
          <input value={form.address_line2} onChange={set("address_line2")} placeholder="Apt, Suite…" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>City</label>
          <input value={form.city} onChange={set("city")} placeholder="City" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>State / Province</label>
          <input value={form.state} onChange={set("state")} placeholder="WA" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Postal Code</label>
          <input value={form.postal_code} onChange={set("postal_code")} placeholder="98101" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <input value={form.country} onChange={set("country")} placeholder="US" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Reason</label>
          <select value={form.reason} onChange={set("reason")} className={inputCls}>
            <option value="">— select reason —</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>{REASON_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Severity</label>
          <select value={form.severity} onChange={set("severity")} className={inputCls}>
            <option value="blocked">Blocked — cannot checkout</option>
            <option value="review">Review — flag for manual review</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={set("status")} className={inputCls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Internal Notes</label>
        <textarea
          value={form.internal_notes}
          onChange={set("internal_notes")}
          rows={3}
          placeholder="Admin-only notes, not visible to customer…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save Restriction"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RestrictedCustomersClient() {
  const [restrictions, setRestrictions] = useState<CustomerRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(BLANK_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // Attempts drawer
  const [attemptsForId, setAttemptsForId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<BlockedAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const loadRestrictions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/admin/customer-restrictions?${params}`);
    const data = await res.json();
    setRestrictions(data.restrictions ?? []);
    setLoading(false);
  }, [search, filterStatus]);

  useEffect(() => { loadRestrictions(); }, [loadRestrictions]);

  async function handleCreate(form: FormState) {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/customer-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to create restriction"); return; }
      setRestrictions((prev) => [data.restriction, ...prev]);
      setShowCreate(false);
      showToast("ok", "Customer restriction created");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(r: CustomerRestriction) {
    setEditingId(r.id);
    setEditForm({
      customer_id:   r.customer_id   ?? "",
      name:          r.name          ?? "",
      email:         r.email         ?? "",
      phone:         r.phone         ?? "",
      address_line1: r.address_line1 ?? "",
      address_line2: r.address_line2 ?? "",
      city:          r.city          ?? "",
      state:         r.state         ?? "",
      postal_code:   r.postal_code   ?? "",
      country:       r.country       ?? "US",
      reason:        r.reason        ?? "",
      internal_notes: r.internal_notes ?? "",
      status:        r.status,
      severity:      r.severity,
    });
  }

  async function handleEditSave(form: FormState) {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/customer-restrictions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Save failed"); return; }
      setRestrictions((prev) => prev.map((r) => r.id === editingId ? { ...r, ...data.restriction } : r));
      setEditingId(null);
      showToast("ok", "Restriction updated");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleStatus(r: CustomerRestriction) {
    const nextStatus = r.status === "active" ? "inactive" : "active";
    const res = await fetch(`/api/admin/customer-restrictions/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) { showToast("err", data.error ?? "Update failed"); return; }
    setRestrictions((prev) => prev.map((x) => x.id === r.id ? { ...x, status: nextStatus } : x));
    showToast("ok", `Restriction ${nextStatus}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Permanently delete this restriction?")) return;
    const res = await fetch(`/api/admin/customer-restrictions/${id}`, { method: "DELETE" });
    if (!res.ok) { showToast("err", "Delete failed"); return; }
    setRestrictions((prev) => prev.filter((r) => r.id !== id));
    showToast("ok", "Restriction deleted");
  }

  async function openAttempts(id: string) {
    setAttemptsForId(id);
    setAttemptsLoading(true);
    const res = await fetch(`/api/admin/customer-restrictions/${id}`);
    const data = await res.json();
    setAttempts(data.attempts ?? []);
    setAttemptsLoading(false);
  }

  const filtered = restrictions.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.name          ?? "").toLowerCase().includes(q) ||
      (r.email         ?? "").toLowerCase().includes(q) ||
      (r.phone         ?? "").toLowerCase().includes(q) ||
      (r.address_line1 ?? "").toLowerCase().includes(q) ||
      (r.city          ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === "ok" ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Restrictions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Customers restricted from completing checkout. Internal use only.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setEditingId(null); }}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shrink-0"
          >
            + Add Restriction
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">New Customer Restriction</h2>
            <RestrictionForm
              initial={BLANK_FORM}
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
              saving={creating}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, address…"
            className="flex-1 min-w-[200px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "inactive")}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No restrictions found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id}>
                {/* Row */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Identity line */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {r.name && (
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</span>
                        )}
                        {r.email && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">{r.email}</span>
                        )}
                        {r.phone && (
                          <span className="text-xs text-gray-400 font-mono">{r.phone}</span>
                        )}
                        {!r.name && !r.email && !r.phone && (
                          <span className="text-sm text-gray-400 italic">No identity fields</span>
                        )}
                      </div>

                      {/* Address */}
                      {(r.address_line1 || r.city) && (
                        <p className="text-xs text-gray-400 mb-1.5">
                          {[r.address_line1, r.address_line2, r.city, r.state, r.postal_code, r.country]
                            .filter(Boolean).join(", ")}
                        </p>
                      )}

                      {/* Badges + meta */}
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={r.status} />
                        <SeverityBadge severity={r.severity} />
                        {r.reason && (
                          <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
                            {REASON_LABELS[r.reason] ?? r.reason}
                          </span>
                        )}
                        {r.customers && (
                          <Link
                            href={`/customers-admin/${r.customers.id}`}
                            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Linked customer →
                          </Link>
                        )}
                        <span className="text-[11px] text-gray-400">Added {fmtDate(r.created_at)}</span>
                      </div>

                      {r.internal_notes && (
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                          {r.internal_notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => openAttempts(r.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        Attempts
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(r)}
                        className={`text-xs font-medium transition-colors ${
                          r.status === "active"
                            ? "text-gray-400 hover:text-gray-600"
                            : "text-emerald-600 hover:text-emerald-700"
                        }`}
                      >
                        {r.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Edit panel */}
                {editingId === r.id && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-emerald-200 dark:border-emerald-800 p-6 mt-1">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Edit Restriction</h3>
                    <RestrictionForm
                      initial={editForm}
                      onSubmit={handleEditSave}
                      onCancel={() => setEditingId(null)}
                      saving={editSaving}
                    />
                  </div>
                )}

                {/* Attempts panel */}
                {attemptsForId === r.id && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mt-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Blocked Checkout Attempts
                      </h3>
                      <button
                        onClick={() => setAttemptsForId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                    {attemptsLoading ? (
                      <p className="text-xs text-gray-400">Loading…</p>
                    ) : attempts.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No blocked attempts recorded.</p>
                    ) : (
                      <div className="space-y-3">
                        {attempts.map((a) => {
                          const cust = a.attempted_customer as { email?: string; name?: string; address?: Record<string, string> } | null;
                          const cart = a.cart_snapshot as { itemCount?: number; subtotalCents?: number } | null;
                          return (
                            <div key={a.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {cust?.name || cust?.email || "Unknown"}
                                </span>
                                <span className="text-gray-400 shrink-0">{fmtDate(a.created_at)}</span>
                              </div>
                              {cust?.email && cust.email !== cust?.name && (
                                <p className="text-gray-500">{cust.email}</p>
                              )}
                              {cust?.address && (
                                <p className="text-gray-400">
                                  {[cust.address.line1, cust.address.city, cust.address.country].filter(Boolean).join(", ")}
                                </p>
                              )}
                              {a.matched_signals && a.matched_signals.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {a.matched_signals.map((s) => (
                                    <span key={s} className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded px-1.5 py-0.5 font-mono">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {cart && (
                                <p className="text-gray-400">
                                  {cart.itemCount ?? "?"} item{(cart.itemCount ?? 0) !== 1 ? "s" : ""}
                                  {cart.subtotalCents != null ? ` · $${(cart.subtotalCents / 100).toFixed(2)}` : ""}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
