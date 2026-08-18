"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClaimSummary {
  id: string;
  claim_number: string;
  claim_type: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

const CLAIM_TYPE_LABELS: Record<string, string> = {
  missing_package: "Missing package",
  damaged_item: "Damaged item",
  not_as_described: "Not as described",
  doesnt_fit: "Doesn't fit",
};

export default function ClaimsSection({ orderNumber }: { orderNumber: string }) {
  const [claims, setClaims] = useState<ClaimSummary[] | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderNumber}/claims`)
      .then((r) => r.json())
      .then((d) => setClaims(d.claims ?? []))
      .catch(() => setClaims([]));
  }, [orderNumber]);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Issue with your order?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Missing, damaged, not as described, or doesn&apos;t fit — we&apos;re here to help.
          </p>
        </div>
        <Link
          href={`/orders/${orderNumber}/claims/new`}
          className="rounded-full bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white transition-colors shrink-0"
        >
          Submit a Claim
        </Link>
      </div>

      {claims && claims.length > 0 && (
        <div className="mt-4 space-y-2">
          {claims.map((c) => (
            <Link
              key={c.id}
              href={`/orders/${orderNumber}/claims/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm hover:border-emerald-400 transition-colors"
            >
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-mono text-xs text-gray-400 mr-2">{c.claim_number}</span>
                {CLAIM_TYPE_LABELS[c.claim_type] ?? c.claim_type}
              </span>
              <span className={`text-xs font-medium ${c.closed_at ? "text-gray-400" : "text-amber-600 dark:text-amber-400"}`}>
                {c.closed_at ? "Closed" : "In progress"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
