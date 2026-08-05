"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/employee/StatusBadge";

type Financials = {
  minimum_price: number | null;
  estimated_fees: number | null;
  estimated_profit: number | null;
  estimated_margin: number | null;
  private_admin_notes: string | null;
} | null;

type SubmissionHistoryItem = {
  version: number;
  submittedAt: string;
  review: { decision: string; employee_visible_feedback: string | null; private_admin_notes: string | null; reviewed_at: string } | null;
};

export function ReviewActionsPanel({
  listingId,
  currentStatus,
  cog,
  cogCurrency,
  existingSalePrice,
  existingFinancials,
  submissionHistory,
}: {
  listingId: string;
  currentStatus: string | null;
  cog: number | null;
  cogCurrency: string | null;
  existingSalePrice: number | null;
  existingFinancials: Financials;
  submissionHistory: SubmissionHistoryItem[];
}) {
  const router = useRouter();
  const [salePriceUsd, setSalePriceUsd] = useState(existingSalePrice != null ? String(existingSalePrice) : "");
  const [minimumPrice, setMinimumPrice] = useState(existingFinancials?.minimum_price != null ? String(existingFinancials.minimum_price) : "");
  const [estimatedFees, setEstimatedFees] = useState(existingFinancials?.estimated_fees != null ? String(existingFinancials.estimated_fees) : "");
  const [estimatedProfit, setEstimatedProfit] = useState(existingFinancials?.estimated_profit != null ? String(existingFinancials.estimated_profit) : "");
  const [estimatedMargin, setEstimatedMargin] = useState(existingFinancials?.estimated_margin != null ? String(existingFinancials.estimated_margin) : "");
  const [employeeVisibleFeedback, setEmployeeVisibleFeedback] = useState("");
  const [privateAdminNotes, setPrivateAdminNotes] = useState(existingFinancials?.private_admin_notes ?? "");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReview = currentStatus === "AWAITING_APPROVAL";

  const runDecision = async (decision: string) => {
    setError(null);
    if (["reject", "request_adjustment", "duplicate"].includes(decision) && !employeeVisibleFeedback.trim()) {
      setError("Feedback is required for this action.");
      return;
    }
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/admin/listing-approvals/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          employeeVisibleFeedback: employeeVisibleFeedback || undefined,
          privateAdminNotes: privateAdminNotes || undefined,
          salePriceUsd: salePriceUsd ? Number(salePriceUsd) : undefined,
          minimumPrice: minimumPrice ? Number(minimumPrice) : undefined,
          estimatedFees: estimatedFees ? Number(estimatedFees) : undefined,
          estimatedProfit: estimatedProfit ? Number(estimatedProfit) : undefined,
          estimatedMargin: estimatedMargin ? Number(estimatedMargin) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed.");
        return;
      }
      router.push("/admin/listing-approvals");
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(null);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Review</h2>
          <StatusBadge status={currentStatus} />
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300">
          COG: <span className="font-medium">{cog != null ? `${cogCurrency ?? "VND"} ${cogCurrency === "CNY" ? cog.toFixed(2) : cog.toLocaleString()}` : "—"}</span>
        </div>

        {!canReview && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This listing isn&apos;t awaiting approval right now — actions below are disabled.
          </p>
        )}

        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sale Price (USD)</label>
            <input type="number" step="0.01" min="0" value={salePriceUsd} onChange={(e) => setSalePriceUsd(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Minimum Price</label>
              <input type="number" step="0.01" value={minimumPrice} onChange={(e) => setMinimumPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Fees</label>
              <input type="number" step="0.01" value={estimatedFees} onChange={(e) => setEstimatedFees(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Profit</label>
              <input type="number" step="0.01" value={estimatedProfit} onChange={(e) => setEstimatedProfit(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Margin %</label>
              <input type="number" step="0.01" value={estimatedMargin} onChange={(e) => setEstimatedMargin(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Private Admin Notes</label>
            <textarea rows={2} value={privateAdminNotes} onChange={(e) => setPrivateAdminNotes(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Employee-Visible Feedback <span className="text-gray-400">(required to reject / request adjustment)</span>
            </label>
            <textarea rows={2} value={employeeVisibleFeedback} onChange={(e) => setEmployeeVisibleFeedback(e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            disabled={!canReview || !!submitting}
            onClick={() => runDecision("approve")}
            className="rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium transition-colors"
          >
            {submitting === "approve" ? "…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={!canReview || !!submitting}
            onClick={() => runDecision("approve_and_publish")}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium transition-colors"
          >
            {submitting === "approve_and_publish" ? "…" : "Approve & Publish"}
          </button>
          <button
            type="button"
            disabled={!canReview || !!submitting}
            onClick={() => runDecision("request_adjustment")}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium transition-colors"
          >
            {submitting === "request_adjustment" ? "…" : "Request Adjustment"}
          </button>
          <button
            type="button"
            disabled={!canReview || !!submitting}
            onClick={() => runDecision("reject")}
            className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-medium transition-colors"
          >
            {submitting === "reject" ? "…" : "Reject"}
          </button>
        </div>
        <button
          type="button"
          disabled={!canReview || !!submitting}
          onClick={() => runDecision("duplicate")}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 px-3 py-2 text-xs font-medium transition-colors"
        >
          {submitting === "duplicate" ? "…" : "Mark as Duplicate"}
        </button>
      </div>

      {submissionHistory.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Submission History</h2>
          <div className="space-y-3">
            {submissionHistory.map((s) => (
              <div key={s.version} className="text-xs border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  Version {s.version} · {new Date(s.submittedAt).toLocaleDateString()}
                </p>
                {s.review && (
                  <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                    {s.review.decision} — {s.review.employee_visible_feedback ?? "(no feedback recorded)"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
