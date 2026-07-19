"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IssueStoreCreditForm } from "@/app/components/IssueStoreCreditForm";

type StoreCreditRow = {
  id: string;
  code: string;
  customer_email: string;
  source_order_id: string | null;
  original_amount_cents: number;
  remaining_amount_cents: number;
  status: "active" | "fully_used" | "expired" | "revoked";
  reason: string;
  expires_at: string | null;
  issued_at: string;
  issued_by: string;
  orders: { order_number: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  fully_used: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StoreCreditsAdminClient() {
  const [rows, setRows] = useState<StoreCreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/store-credits?${params}`);
    const data = await res.json();
    setRows(data.storeCredits ?? []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  async function download(type: string) {
    setDownloading(type);
    try {
      const res = await fetch(`/api/admin/store-credits/export?type=${type}`);
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${type}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Store Credits</h1>
        <div className="flex gap-2">
          <button onClick={() => download("credits")} disabled={downloading === "credits"} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            {downloading === "credits" ? "…" : "Export Credits CSV"}
          </button>
          <button onClick={() => download("transactions")} disabled={downloading === "transactions"} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            {downloading === "transactions" ? "…" : "Export Ledger CSV"}
          </button>
          <button onClick={() => setShowIssueForm(true)} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors">
            + Issue Store Credit
          </button>
        </div>
      </div>

      {showIssueForm && (
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <IssueStoreCreditForm
            onIssued={() => { setShowIssueForm(false); load(); }}
            onCancel={() => setShowIssueForm(false)}
          />
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by email, code, order number, or reason"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="fully_used">Fully Used</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Original</th>
              <th className="px-4 py-2.5">Remaining</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Expires</th>
              <th className="px-4 py-2.5">Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No store credits found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/store-credits-admin/${r.id}`} className="font-mono text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.customer_email}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.orders?.order_number ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtMoney(r.original_amount_cents)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{fmtMoney(r.remaining_amount_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.expires_at ? fmtDate(r.expires_at) : "Never"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(r.issued_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
