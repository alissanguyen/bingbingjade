export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PayoutRow = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  approved_listing_count: number;
  gross_listing_pay: number;
  bonus_amount: number;
  adjustment_amount: number;
  deduction_amount: number;
  final_amount: number;
  payment_method: string | null;
  scheduled_pay_date: string | null;
  actual_paid_date: string | null;
  status: string;
};

type ItemRow = { id: string; amount: number; products: { name: string } | null };

export default async function EmployeePayoutDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string; payoutId: string }>;
}) {
  const { employeeId, payoutId } = await params;

  const { data: payout } = await supabaseAdmin
    .from("employee_payouts")
    .select("id, employee_id, period_start, period_end, approved_listing_count, gross_listing_pay, bonus_amount, adjustment_amount, deduction_amount, final_amount, payment_method, scheduled_pay_date, actual_paid_date, status")
    .eq("id", payoutId)
    .maybeSingle<PayoutRow>();

  // A payout belonging to another employee looks identical to a nonexistent
  // one from this employee's perspective — no signal either way.
  if (!payout || payout.employee_id !== employeeId) notFound();

  const { data: items } = await supabaseAdmin
    .from("employee_payout_items")
    .select("id, amount, products(name)")
    .eq("payout_id", payoutId)
    .returns<ItemRow[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Payout: {payout.period_start} → {payout.period_end}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Status: {payout.status}</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><p className="text-xs text-gray-400">Listings</p><p>{payout.approved_listing_count}</p></div>
        <div><p className="text-xs text-gray-400">Gross Pay</p><p>${Number(payout.gross_listing_pay).toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">Bonus</p><p>${Number(payout.bonus_amount).toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">Adjustment</p><p>${Number(payout.adjustment_amount).toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">Deduction</p><p>${Number(payout.deduction_amount).toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">Final Amount</p><p className="font-semibold">${Number(payout.final_amount).toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-400">Payment Method</p><p>{payout.payment_method ?? "—"}</p></div>
        <div><p className="text-xs text-gray-400">Scheduled</p><p>{payout.scheduled_pay_date ?? "—"}</p></div>
        <div><p className="text-xs text-gray-400">Paid</p><p>{payout.actual_paid_date ?? "—"}</p></div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Listings Included</h2>
        <div className="space-y-2">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">{item.products?.name ?? "Listing"}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">${Number(item.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
