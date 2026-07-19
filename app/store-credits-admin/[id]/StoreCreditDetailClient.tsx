"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { EmailPreviewModal } from "@/app/custom-emails-admin/EmailPreviewModal";

type StoreCredit = {
  id: string;
  code: string;
  customer_email: string;
  source_order_id: string | null;
  original_amount_cents: number;
  remaining_amount_cents: number;
  status: "active" | "fully_used" | "expired" | "revoked";
  reason: string;
  customer_message: string | null;
  internal_note: string | null;
  issued_at: string;
  issued_by: string;
  expires_at: string | null;
  starts_at: string | null;
  usage_mode: string;
  orders: { order_number: string; customer_name: string } | null;
};

type Transaction = {
  id: string;
  transaction_type: string;
  amount_cents: number;
  balance_before_cents: number;
  balance_after_cents: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  order_id: string | null;
  orders: { order_number: string } | null;
};

function fmtMoney(cents: number) {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function StoreCreditDetailClient({ id }: { id: string }) {
  const [storeCredit, setStoreCredit] = useState<StoreCredit | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reconciled, setReconciled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/store-credits/${id}`);
    const data = await res.json();
    setStoreCredit(data.storeCredit ?? null);
    setTransactions(data.transactions ?? []);
    setReconciled(data.reconciled ?? true);
    setExpiresAtInput(data.storeCredit?.expires_at ? data.storeCredit.expires_at.slice(0, 10) : "");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patch(action: string, extra: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/store-credits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Action failed.");
        return;
      }
      setMessage("Saved.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resendEmail() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/store-credits/${id}/resend-email`, { method: "POST" });
      const data = await res.json();
      setMessage(res.ok ? "Email resent." : (data.error ?? "Failed to resend email."));
    } finally {
      setBusy(false);
    }
  }

  async function previewEmail() {
    setMessage(null);
    const res = await fetch(`/api/admin/store-credits/${id}/resend-email`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to load preview.");
      return;
    }
    setPreviewHtml(data.html);
  }

  function copyCode() {
    if (storeCredit) navigator.clipboard.writeText(storeCredit.code);
    setMessage("Code copied.");
  }

  if (loading || !storeCredit) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-400">Loading…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link href="/store-credits-admin" className="text-sm text-gray-400 hover:text-emerald-600">&larr; All Store Credits</Link>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">{storeCredit.code}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{storeCredit.customer_email}</p>
          </div>
          <button onClick={copyCode} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            Copy Code
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Original</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtMoney(storeCredit.original_amount_cents)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmtMoney(storeCredit.remaining_amount_cents)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{storeCredit.status.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{storeCredit.reason.replace(/_/g, " ")}</p>
          </div>
        </div>

        {!reconciled && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">⚠ Cached balance does not match the transaction ledger — investigate before adjusting.</p>
        )}

        {storeCredit.orders && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Source order: <Link href={`/orders-admin/${storeCredit.source_order_id}`} className="text-emerald-700 dark:text-emerald-400 hover:underline">{storeCredit.orders.order_number}</Link>
          </p>
        )}
        {storeCredit.internal_note && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2"><span className="font-medium">Internal note:</span> {storeCredit.internal_note}</p>
        )}

        {message && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={previewEmail} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            Preview Email
          </button>
          <button onClick={resendEmail} disabled={busy} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            Resend Email
          </button>
        </div>
      </div>

      {previewHtml && <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}

      {/* Expiration */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Expiration</h2>
        <div className="flex gap-2">
          <input type="date" value={expiresAtInput} onChange={(e) => setExpiresAtInput(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          <button
            disabled={busy}
            onClick={() => patch("set_expiration", { expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : null })}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs font-medium"
          >
            Save
          </button>
          <button
            disabled={busy || !storeCredit.expires_at}
            onClick={() => { setExpiresAtInput(""); patch("set_expiration", { expiresAt: null }); }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300"
          >
            Remove Expiration
          </button>
        </div>
      </div>

      {/* Balance adjustment */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Adjust Balance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input type="number" step="0.01" placeholder="+ or − amount (USD)" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          <input type="text" placeholder="Reason (required)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 sm:col-span-1" />
          <button
            disabled={busy || !adjustDelta || !adjustReason.trim()}
            onClick={() => {
              patch("adjust_balance", { deltaCents: Math.round(Number(adjustDelta) * 100), reason: adjustReason.trim() });
              setAdjustDelta(""); setAdjustReason("");
            }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium"
          >
            Apply Adjustment
          </button>
        </div>
      </div>

      {/* Transfer */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Transfer to Another Email</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input type="email" placeholder="New email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          <input type="text" placeholder="Reason (required)" value={transferReason} onChange={(e) => setTransferReason(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
          <button
            disabled={busy || !transferEmail.trim() || !transferReason.trim()}
            onClick={() => {
              patch("transfer", { newEmail: transferEmail.trim(), reason: transferReason.trim() });
              setTransferEmail(""); setTransferReason("");
            }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium"
          >
            Transfer
          </button>
        </div>
      </div>

      {/* Revoke */}
      {storeCredit.status === "active" && storeCredit.remaining_amount_cents > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900/50 p-5">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3">Revoke Unused Credit</h2>
          <div className="flex gap-2">
            <input type="text" placeholder="Reason (required)" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100" />
            <button
              disabled={busy || !revokeReason.trim()}
              onClick={() => { patch("revoke", { reason: revokeReason.trim() }); setRevokeReason(""); }}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium"
            >
              Revoke
            </button>
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 p-5 pb-3">Transaction History</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Balance After</th>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">By</th>
              <th className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{t.transaction_type.replace(/_/g, " ")}</td>
                <td className={`px-4 py-2.5 font-medium ${t.amount_cents < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {fmtMoney(t.amount_cents)}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmtMoney(t.balance_after_cents)}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                  {t.orders ? <Link href={`/orders-admin/${t.order_id}`} className="text-emerald-700 dark:text-emerald-400 hover:underline">{t.orders.order_number}</Link> : "—"}
                </td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{t.reason ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{t.created_by ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmtDateTime(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
