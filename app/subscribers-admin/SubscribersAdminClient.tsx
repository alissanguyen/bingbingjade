"use client";

import { useState } from "react";

export type Subscriber = {
  id: string;
  email: string;
  subscribed_at: string;
  welcome_coupon_code: string | null;
  welcome_coupon_expires_at: string | null;
  welcome_discount_redeemed_at: string | null;
  used_fingerprint: string | null;
  source: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function couponStatus(s: Subscriber): { label: string; cls: string } {
  if (s.welcome_discount_redeemed_at)
    return { label: "Used", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
  if (!s.welcome_coupon_code)
    return { label: "No code", cls: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" };
  if (s.welcome_coupon_expires_at && new Date(s.welcome_coupon_expires_at) < new Date())
    return { label: "Expired", cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" };
  return { label: "Active", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" };
}

const TAB_VALUES = ["all", "active", "used", "expired"] as const;

export function SubscribersAdminClient({ subscribers: initial }: { subscribers: Subscriber[] }) {
  const [tab, setTab] = useState<(typeof TAB_VALUES)[number]>("all");
  const [subscribers, setSubscribers] = useState(initial);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ subject: "", message: "", target: "all" as "all" | "unused" });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleBackfill() {
    if (!confirm("Generate coupon codes for all existing subscribers without one? This does not send any emails.")) return;
    setBackfilling(true);
    try {
      const res = await fetch("/api/admin/subscribers/backfill-coupons", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Done — ${data.assigned} codes assigned, ${data.skipped} skipped.`);
        await loadTab(tab); // refresh the list
      } else {
        showToast(data.error ?? "Backfill failed.");
      }
    } finally {
      setBackfilling(false);
    }
  }

  async function loadTab(t: (typeof TAB_VALUES)[number]) {
    setTab(t);
    const res = await fetch(`/api/admin/subscribers?status=${t}`);
    if (res.ok) setSubscribers(await res.json());
  }

  async function handleResend(subscriber: Subscriber) {
    if (!subscriber.welcome_coupon_code) return;
    setResending(subscriber.id);
    try {
      const res = await fetch(`/api/admin/subscribers/${subscriber.id}/resend`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Coupon email resent to ${subscriber.email}`);
      } else {
        showToast(data.error ?? "Failed to resend.");
      }
    } finally {
      setResending(null);
    }
  }

  async function handleBulkSend(e: React.FormEvent) {
    e.preventDefault();
    setBulkSending(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/subscribers/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkForm),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResult(data);
      } else {
        showToast(data.error ?? "Bulk send failed.");
      }
    } finally {
      setBulkSending(false);
    }
  }

  const now = new Date();
  const filteredLocal = subscribers.filter((s) => {
    if (tab === "used") return !!s.welcome_discount_redeemed_at;
    if (tab === "active") return s.welcome_coupon_code && !s.welcome_discount_redeemed_at && s.welcome_coupon_expires_at && new Date(s.welcome_coupon_expires_at) > now;
    if (tab === "expired") return s.welcome_coupon_code && !s.welcome_discount_redeemed_at && s.welcome_coupon_expires_at && new Date(s.welcome_coupon_expires_at) < now;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Subscribers</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{initial.length} total</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfilling}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {backfilling ? "Backfilling…" : "Backfill Coupons"}
          </button>
          <button
            type="button"
            onClick={() => { setShowBulkModal(true); setBulkResult(null); }}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            Bulk Email
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {TAB_VALUES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => loadTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === t
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredLocal.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No subscribers in this view.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Coupon</th>
                <th className="text-left px-4 py-3 font-medium">Expiry</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Subscribed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredLocal.map((s) => {
                const status = couponStatus(s);
                const canResend = !!s.welcome_coupon_code && !s.welcome_discount_redeemed_at;
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <span className="text-gray-900 dark:text-gray-100">{s.email}</span>
                      {s.used_fingerprint && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400" title={`Fingerprint: ${s.used_fingerprint}`}>⚠ fingerprint</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                      {s.welcome_coupon_code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {s.welcome_coupon_expires_at ? fmt(s.welcome_coupon_expires_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {fmt(s.subscribed_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canResend && (
                        <button
                          type="button"
                          disabled={resending === s.id}
                          onClick={() => handleResend(s)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                        >
                          {resending === s.id ? "Sending…" : "Resend"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Bulk email modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Bulk Email Subscribers</h2>
              <button type="button" onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>

            {bulkResult ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Sent to <strong>{bulkResult.sent}</strong> of <strong>{bulkResult.total}</strong> subscribers.
                  {bulkResult.failed > 0 && <span className="text-red-600 dark:text-red-400"> {bulkResult.failed} failed.</span>}
                </p>
                <button type="button" onClick={() => { setShowBulkModal(false); setBulkResult(null); setBulkForm({ subject: "", message: "", target: "all" }); }} className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkSend} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Recipients</label>
                  <select value={bulkForm.target} onChange={(e) => setBulkForm((f) => ({ ...f, target: e.target.value as "all" | "unused" }))} className={inputCls}>
                    <option value="all">All subscribers</option>
                    <option value="unused">Subscribers with unused coupon only</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Subject</label>
                  <input value={bulkForm.subject} onChange={(e) => setBulkForm((f) => ({ ...f, subject: e.target.value }))} required placeholder="Black Friday Sale — 20% Off Starts Now!" className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Message (plain text, double line-break = new paragraph)</label>
                  <textarea value={bulkForm.message} onChange={(e) => setBulkForm((f) => ({ ...f, message: e.target.value }))} required rows={6} placeholder="Hi there!&#10;&#10;Our Black Friday sale is live — use code BLACKFRI25 at checkout for 20% off your entire order.&#10;&#10;Shop now at bingbingjade.com" className={`${inputCls} resize-none`} />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={bulkSending} className="text-sm font-medium px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors">
                    {bulkSending ? "Sending…" : "Send"}
                  </button>
                  <button type="button" onClick={() => setShowBulkModal(false)} className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500";
