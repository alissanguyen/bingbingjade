export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CreditRow = { rate_at_approval: number; payout_status: string; revoked_at: string | null };
type PayoutRow = {
  id: string;
  period_start: string;
  period_end: string;
  approved_listing_count: number;
  final_amount: number;
  bonus_amount: number;
  adjustment_amount: number;
  deduction_amount: number;
  payment_method: string | null;
  scheduled_pay_date: string | null;
  actual_paid_date: string | null;
  status: string;
};

export default async function EmployeePayPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const [{ data: credits }, { data: payouts }] = await Promise.all([
    supabaseAdmin
      .from("listing_approval_credits")
      .select("rate_at_approval, payout_status, revoked_at")
      .eq("employee_id", employeeId)
      .returns<CreditRow[]>(),
    supabaseAdmin
      .from("employee_payouts")
      .select("id, period_start, period_end, approved_listing_count, final_amount, bonus_amount, adjustment_amount, deduction_amount, payment_method, scheduled_pay_date, actual_paid_date, status")
      .eq("employee_id", employeeId)
      .order("period_start", { ascending: false })
      .returns<PayoutRow[]>(),
  ]);

  const eligible = (credits ?? []).filter((c) => c.payout_status === "unpaid" && c.revoked_at === null);
  const estimatedCompensation = eligible.reduce((sum, c) => sum + Number(c.rate_at_approval), 0);

  const openPayout = (payouts ?? []).find((p) => p.status === "DRAFT" || p.status === "SCHEDULED" || p.status === "PROCESSING");

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Current Compensation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{eligible.length}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Approved listings, unpaid</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">${estimatedCompensation.toFixed(2)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Estimated compensation</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {openPayout?.scheduled_pay_date ? new Date(openPayout.scheduled_pay_date).toLocaleDateString() : "—"}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Upcoming payday</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{openPayout?.status ?? "—"}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Current payout status</p>
          </div>
        </div>
        {openPayout && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Period {openPayout.period_start} → {openPayout.period_end}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Payout History</h2>
        {(payouts ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No payouts yet.</p>
        ) : (
          <div className="space-y-3">
            {(payouts ?? []).map((p) => (
              <Link
                key={p.id}
                href={`/employee/${employeeId}/pay/${p.id}`}
                className="block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {p.period_start} → {p.period_end}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.approved_listing_count} listings · bonus ${Number(p.bonus_amount).toFixed(2)} · adj ${Number(p.adjustment_amount).toFixed(2)} · deduction ${Number(p.deduction_amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.payment_method ?? "—"} · scheduled {p.scheduled_pay_date ?? "—"} · paid {p.actual_paid_date ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">${Number(p.final_amount).toFixed(2)}</p>
                    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {p.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
