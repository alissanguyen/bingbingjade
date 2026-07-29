export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";

type ProfileRow = {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  start_date: string;
  status: "active" | "suspended" | "terminated";
};

type UserRow = { email: string };

type ProductRow = { id: string; listing_status: string | null };
type SubmissionRow = { id: string; product_id: string; version: number };
type ReviewRow = { submission_id: string; decision: string };
type CreditRow = { payout_status: string; revoked_at: string | null };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function EmployeeDashboardPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const [{ data: profile }, { data: user }, { data: products }, { data: submissions }, { data: credits }] =
    await Promise.all([
      supabaseAdmin
        .from("employee_profiles")
        .select("display_name, bio, avatar_url, start_date, status")
        .eq("user_id", employeeId)
        .single<ProfileRow>(),
      supabaseAdmin.from("approved_users").select("email").eq("id", employeeId).single<UserRow>(),
      supabaseAdmin
        .from("products")
        .select("id, listing_status")
        .eq("created_by_employee_id", employeeId)
        .returns<ProductRow[]>(),
      supabaseAdmin
        .from("listing_submissions")
        .select("id, product_id, version")
        .eq("employee_id", employeeId)
        .returns<SubmissionRow[]>(),
      supabaseAdmin
        .from("listing_approval_credits")
        .select("payout_status, revoked_at")
        .eq("employee_id", employeeId)
        .returns<CreditRow[]>(),
    ]);

  const rows = products ?? [];
  const statusCount = (s: string) => rows.filter((r) => r.listing_status === s).length;

  const draftCount = statusCount("EMPLOYEE_DRAFT");
  const awaitingCount = statusCount("AWAITING_APPROVAL");
  const needsAdjustmentCount = statusCount("NEEDS_ADJUSTMENT");
  const approvedCount = statusCount("APPROVED_UNPUBLISHED") + statusCount("PUBLISHED");
  const rejectedCount = statusCount("REJECTED");

  const activeCredits = (credits ?? []).filter((c) => c.revoked_at === null);
  const paidCount = activeCredits.filter((c) => c.payout_status === "paid").length;
  const approvedUnpaidCount = activeCredits.filter((c) => c.payout_status !== "paid").length;

  // Approval-rate math: only listings that have reached a FINAL decision
  // (approved or rejected) count — drafts and still-awaiting listings never
  // enter either the numerator or denominator.
  const reviewedFinal = approvedCount + rejectedCount;
  const finalApprovalRate = pct(approvedCount, reviewedFinal);

  // First-pass rate: among first-time (version 1) submissions that have
  // received a review decision at all, how many were approved on that very
  // first review (not after an adjustment round).
  const firstSubmissions = (submissions ?? []).filter((s) => s.version === 1);
  const firstSubmissionIds = firstSubmissions.map((s) => s.id);
  let firstPassReviewed = 0;
  let firstPassApproved = 0;
  if (firstSubmissionIds.length > 0) {
    const { data: firstReviews } = await supabaseAdmin
      .from("listing_reviews")
      .select("submission_id, decision")
      .in("submission_id", firstSubmissionIds)
      .returns<ReviewRow[]>();
    firstPassReviewed = firstReviews?.length ?? 0;
    firstPassApproved = (firstReviews ?? []).filter((r) => r.decision === "approve" || r.decision === "approve_and_publish").length;
  }
  const firstPassRate = pct(firstPassApproved, firstPassReviewed);

  const statusBadge: Record<string, string> = {
    active: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    suspended: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    terminated: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  };

  const statCard = (label: string, value: number | string) => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Profile */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col sm:flex-row gap-5">
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xl font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
            {(profile?.display_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{profile?.display_name}</h1>
            {profile?.status && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadge[profile.status]}`}>
                {profile.status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          {profile?.start_date && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Started {fmtDate(profile.start_date)}</p>
          )}
          {profile?.bio && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{profile.bio}</p>}
        </div>
      </section>

      {/* Listing statistics */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Listing Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCard("Total Listings", rows.length)}
          {statCard("Drafts", draftCount)}
          {statCard("Awaiting Approval", awaitingCount)}
          {statCard("Needs Adjustment", needsAdjustmentCount)}
          {statCard("Approved", approvedCount)}
          {statCard("Rejected", rejectedCount)}
          {statCard("Paid Listings", paidCount)}
          {statCard("Approved, Unpaid", approvedUnpaidCount)}
        </div>
      </section>

      {/* Approval metrics */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Approval Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{finalApprovalRate}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Final approval rate ({approvedCount} approved / {reviewedFinal} reviewed)
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{firstPassRate}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              First-pass approval rate ({firstPassApproved} / {firstPassReviewed} first submissions)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
