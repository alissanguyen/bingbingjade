export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProductRow = { id: string; name: string; current_submission_version: number };
type SubmissionRow = { id: string; product_id: string; version: number };
type ReviewRow = { submission_id: string; employee_visible_feedback: string | null; reviewed_at: string };

export default async function EmployeeAdjustmentsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, current_submission_version")
    .eq("created_by_employee_id", employeeId)
    .eq("listing_status", "NEEDS_ADJUSTMENT")
    .returns<ProductRow[]>();

  const rows = products ?? [];
  const feedbackByProduct = new Map<string, { feedback: string | null; reviewedAt: string }>();

  if (rows.length > 0) {
    const { data: submissions } = await supabaseAdmin
      .from("listing_submissions")
      .select("id, product_id, version")
      .in("product_id", rows.map((r) => r.id))
      .returns<SubmissionRow[]>();

    // The review that matters is against each product's CURRENT submission
    // version (the one that triggered NEEDS_ADJUSTMENT), not any earlier one.
    const currentSubmissionByProduct = new Map(
      rows.map((r) => {
        const match = (submissions ?? []).find((s) => s.product_id === r.id && s.version === r.current_submission_version);
        return [r.id, match?.id];
      })
    );
    const submissionIds = [...currentSubmissionByProduct.values()].filter((v): v is string => !!v);

    if (submissionIds.length > 0) {
      const { data: reviews } = await supabaseAdmin
        .from("listing_reviews")
        .select("submission_id, employee_visible_feedback, reviewed_at")
        .in("submission_id", submissionIds)
        .returns<ReviewRow[]>();

      for (const [productId, submissionId] of currentSubmissionByProduct) {
        const review = (reviews ?? []).find((r) => r.submission_id === submissionId);
        if (review) feedbackByProduct.set(productId, { feedback: review.employee_visible_feedback, reviewedAt: review.reviewed_at });
      }
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Needs Adjustment</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing needs adjustment right now.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const info = feedbackByProduct.get(row.id);
            return (
              <div key={row.id} className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{row.name || "Untitled listing"}</p>
                  <Link
                    href={`/employee/${employeeId}/listings/${row.id}/edit`}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    Edit &amp; Resubmit
                  </Link>
                </div>
                {info?.feedback && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{info.feedback}</p>
                )}
                {info?.reviewedAt && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Returned {new Date(info.reviewedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
