"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClaimRow {
  id: string;
  claim_number: string;
  claim_type: string;
  status: string;
  responsibility: string;
  priority: string;
  assigned_admin: string | null;
  next_action: string | null;
  customer_email: string;
  opened_at: string;
  closed_at: string | null;
  orders: { order_number: string | null; customer_name: string | null };
}

const RESPONSIBILITY_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "bbj_action_required", label: "Needs BBJ Action" },
  { value: "customer_action_required", label: "Waiting on Customer" },
  { value: "waiting_on_carrier", label: "Waiting on Carrier" },
  { value: "waiting_on_insurer", label: "Waiting on Insurance" },
  { value: "waiting_on_vendor", label: "Waiting on Vendor" },
  { value: "return_in_transit", label: "Returns In Transit" },
  { value: "inspecting", label: "Inspecting" },
  { value: "resolution_pending", label: "Resolution Needed" },
  { value: "closed", label: "Closed" },
];

const CLAIM_TYPE_LABELS: Record<string, string> = {
  missing_package: "Missing package",
  damaged_item: "Damaged item",
  not_as_described: "Not as described",
  doesnt_fit: "Doesn't fit",
};

export function ClaimsAdminClient() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [responsibility, setResponsibility] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (responsibility) params.set("responsibility", responsibility);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/claims?${params}`)
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .finally(() => setLoading(false));
  }, [responsibility, q]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Claims</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {RESPONSIBILITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setResponsibility(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              responsibility === f.value
                ? "bg-emerald-700 border-emerald-700 text-white"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search claim #, order #, customer, tracking, SKU, certificate…"
        className="w-full max-w-md mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100"
      />

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Claim</th>
              <th className="text-left px-4 py-2.5 font-medium">Order</th>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Next action</th>
              <th className="text-left px-4 py-2.5 font-medium">Opened</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <td className="px-4 py-2.5">
                  <Link href={`/claims-admin/${c.id}`} className="font-mono text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                    {c.claim_number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {c.orders?.order_number} <span className="text-gray-400">· {c.customer_email}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{CLAIM_TYPE_LABELS[c.claim_type] ?? c.claim_type}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{c.status.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{c.next_action ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-400">{new Date(c.opened_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!loading && claims.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No claims found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
