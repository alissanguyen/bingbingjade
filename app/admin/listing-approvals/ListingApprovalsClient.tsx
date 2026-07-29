"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/app/employee/StatusBadge";

type QueueRow = {
  id: string;
  name: string;
  category: string;
  thumbnail: string | null;
  listingStatus: string | null;
  submissionVersion: number;
  employeeId: string | null;
  employeeName: string | null;
  cog: number | null;
  cogCurrency: string | null;
  hasSalePrice: boolean;
  createdAt: string;
  isFirstSubmission: boolean;
  priorAdjustmentRequests: number;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "AWAITING_APPROVAL", label: "Awaiting Approval" },
  { value: "NEEDS_ADJUSTMENT", label: "Needs Adjustment" },
  { value: "APPROVED_UNPUBLISHED", label: "Approved (Unpublished)" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
];

export function ListingApprovalsClient() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("AWAITING_APPROVAL");
  const [submissionType, setSubmissionType] = useState("");
  const [missingSalePrice, setMissingSalePrice] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (submissionType) params.set("submissionType", submissionType);
    if (missingSalePrice) params.set("missingSalePrice", "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch-on-filter-change loading flag; same pattern used elsewhere in this codebase
    setLoading(true);
    fetch(`/api/admin/listing-approvals?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data.queue ?? []))
      .finally(() => setLoading(false));
  }, [status, submissionType, missingSalePrice]);

  const selectCls =
    "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={submissionType} onChange={(e) => setSubmissionType(e.target.value)} className={selectCls}>
          <option value="">First or resubmission</option>
          <option value="first">First submission only</option>
          <option value="resubmission">Resubmissions only</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={missingSalePrice} onChange={(e) => setMissingSalePrice(e.target.checked)} className="rounded" />
          Missing sale price
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing matches these filters.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <a
              key={row.id}
              href={`/admin/listing-approvals/${row.id}`}
              className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                {row.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.thumbnail} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{row.name || "Untitled listing"}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                  {row.category} · {row.employeeName} · v{row.submissionVersion}
                  {!row.isFirstSubmission && " (resubmission)"}
                  {row.priorAdjustmentRequests > 0 && ` · ${row.priorAdjustmentRequests} prior adjustment${row.priorAdjustmentRequests > 1 ? "s" : ""}`}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  COG: {row.cog != null ? `${row.cogCurrency ?? "USD"} ${row.cog.toFixed(2)}` : "—"}
                  {" · "}
                  {new Date(row.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!row.hasSalePrice && (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0">No sale price</span>
              )}
              <StatusBadge status={row.listingStatus} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
