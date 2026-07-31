"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Row {
  id: string;
  request_number: string | null;
  status: string;
  capture_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  price_cents: number | null;
  created_at: string;
  service: { name: string; slug: string } | null;
  imageCount: number;
  thumbnailUrl: string | null;
}

const STATUS_OPTIONS = [
  "", "draft", "pending_review", "awaiting_images", "quote_needed", "quote_sent", "authorization_pending",
  "authorized", "approved", "rejected", "awaiting_shipment", "received", "in_progress", "quality_control",
  "ready_to_return", "shipped_back", "completed", "cancelled", "refunded",
];

function money(cents: number | null): string {
  return cents ? `$${(cents / 100).toFixed(2)}` : "—";
}

export function ServiceRequestsListClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/service-requests?${params.toString()}`);
      const data = await res.json();
      setRows(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search customer, email, request #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2">Photos</th>
              <th className="px-4 py-2">Request #</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No service requests found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/service-requests/${r.id}`} className="flex items-center gap-2">
                      {r.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="h-9 w-9 rounded bg-gray-100 dark:bg-gray-800" />
                      )}
                      <span className="text-xs text-gray-500">{r.imageCount} customer image{r.imageCount === 1 ? "" : "s"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/service-requests/${r.id}`} className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                      {r.request_number ?? r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{r.service?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div>{r.customer_name ?? "—"}</div>
                    <div className="text-xs text-gray-400">{r.customer_email}</div>
                  </td>
                  <td className="px-4 py-2"><span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">{r.status}</span></td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.capture_status ?? "—"}</td>
                  <td className="px-4 py-2">{money(r.price_cents)}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
