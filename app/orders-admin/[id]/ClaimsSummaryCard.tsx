"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClaimRow {
  id: string;
  claim_number: string;
  claim_type: string;
  status: string;
  responsibility: string;
  next_action: string | null;
  opened_at: string;
  closed_at: string | null;
}

// Embedded Claims / Returns summary inside /orders-admin/[id] (§40). Full
// detail (evidence, returns, resolution, financial ledger, timeline) lives
// at /claims-admin/[claimId] — this card is a compact pointer into it.
export function ClaimsSummaryCard({ orderId }: { orderId: string }) {
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/orders/${orderId}/claims`)
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .catch(() => setClaims([]));
  }, [orderId]);

  if (!claims || claims.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Claims / Returns</h2>
      {claims.map((c) => (
        <Link
          key={c.id}
          href={`/claims-admin/${c.id}`}
          className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm hover:border-emerald-400 transition-colors"
        >
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-mono text-xs text-gray-400 mr-2">{c.claim_number}</span>
            {c.claim_type.replace(/_/g, " ")}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{c.status.replace(/_/g, " ")}</span>
        </Link>
      ))}
    </div>
  );
}
