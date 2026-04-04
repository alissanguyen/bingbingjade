import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";

export const dynamic = "force-dynamic";

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  paid:             "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  refunded:         "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  expired:          "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
};

const SOURCING_STATUS_COLORS: Record<string, string> = {
  queued:       "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  options_sent: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  in_progress:  "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  fulfilled:    "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  cancelled:    "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const REQUEST_TYPE_COLORS: Record<string, string> = {
  standard: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
  premium:  "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default async function SourcingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; sourcing?: string; type?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) notFound();

  const { payment, sourcing, type } = await searchParams;

  let query = supabaseAdmin
    .from("sourcing_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (payment) query = query.eq("payment_status", payment);
  if (sourcing) query = query.eq("sourcing_status", sourcing);
  if (type) query = query.eq("request_type", type);

  const { data: requests } = await query;

  // Fetch ledger rows for all requests to compute available credits
  const requestIds = (requests ?? []).map((r) => r.id as string);
  let ledgerMap: Map<string, LedgerRow[]> = new Map();

  if (requestIds.length > 0) {
    const { data: ledger } = await supabaseAdmin
      .from("sourcing_credit_ledger")
      .select("sourcing_request_id, event_type, amount_cents")
      .in("sourcing_request_id", requestIds);

    for (const row of ledger ?? []) {
      const id = row.sourcing_request_id as string;
      if (!ledgerMap.has(id)) ledgerMap.set(id, []);
      ledgerMap.get(id)!.push({
        event_type: row.event_type as LedgerRow["event_type"],
        amount_cents: row.amount_cents as number,
      });
    }
  }

  return (
    <>
      <AdminBarServer />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
              Admin
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sourcing Requests</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {requests?.length ?? 0} request{requests?.length !== 1 ? "s" : ""}
              {payment || sourcing || type ? " (filtered)" : ""}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          <Link href="/sourcing-admin" className={`px-3 py-1.5 rounded-full border font-medium transition-colors ${!payment && !sourcing && !type ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}>All</Link>
          <Link href="/sourcing-admin?payment=awaiting_payment" className="px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-medium transition-colors">Awaiting Payment</Link>
          <Link href="/sourcing-admin?payment=paid" className="px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-medium transition-colors">Paid</Link>
          <Link href="/sourcing-admin?sourcing=queued" className="px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 font-medium transition-colors">Queued</Link>
          <Link href="/sourcing-admin?sourcing=options_sent" className="px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-medium transition-colors">Options Sent</Link>
          <Link href="/sourcing-admin?type=premium" className="px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20 font-medium transition-colors">Premium Only</Link>
        </div>

        {(!requests || requests.length === 0) && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-12 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No sourcing requests found.</p>
          </div>
        )}

        <div className="space-y-4">
          {(requests ?? []).map((req) => {
            const prefs = req.preferences_json as Record<string, unknown> ?? {};
            const ledgerRows = ledgerMap.get(req.id as string) ?? [];
            const availableCredit = req.payment_status === "paid"
              ? computeAvailableCredit(req.deposit_amount_cents as number, ledgerRows)
              : 0;

            return (
              <div key={req.id as string} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
                {/* Header row */}
                <div className="px-5 py-4 flex flex-wrap items-start gap-3 justify-between border-b border-gray-100 dark:border-gray-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{String(req.customer_name)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{String(req.customer_email)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        label={String(req.payment_status)}
                        colorClass={PAYMENT_STATUS_COLORS[String(req.payment_status)] ?? "bg-gray-100 text-gray-500"}
                      />
                      <Badge
                        label={String(req.sourcing_status)}
                        colorClass={SOURCING_STATUS_COLORS[String(req.sourcing_status)] ?? "bg-gray-100 text-gray-500"}
                      />
                      <Badge
                        label={String(req.request_type)}
                        colorClass={REQUEST_TYPE_COLORS[String(req.request_type)] ?? "bg-gray-100 text-gray-500"}
                      />
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                    <p className="font-mono">{String(req.id).slice(0, 8)}…</p>
                    <p>{new Date(String(req.created_at)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Category</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200 capitalize">{String(req.category)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Budget</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      ${Number(req.budget_min)}{req.budget_max ? `–$${Number(req.budget_max)}` : "+"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Deposit</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      ${(Number(req.deposit_amount_cents) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Credit remaining</p>
                    <p className={`font-semibold ${availableCredit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-600"}`}>
                      ${(availableCredit / 100).toFixed(2)}
                    </p>
                  </div>

                  {!!prefs.preferred_color && (
                    <div>
                      <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Color</p>
                      <p className="text-gray-700 dark:text-gray-300">{String(prefs.preferred_color)}</p>
                    </div>
                  )}
                  {!!prefs.must_haves && (
                    <div className="sm:col-span-2">
                      <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Must-haves</p>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{String(prefs.must_haves)}</p>
                    </div>
                  )}
                  {!!prefs.notes && (
                    <div className="sm:col-span-2">
                      <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{String(prefs.notes)}</p>
                    </div>
                  )}

                  {/* Strictness flags */}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                      Strictness flags (score: {Number(req.strictness_score)})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {!!prefs.close_reference_match && <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-[10px]">Photo match (+2)</span>}
                      {!!prefs.exact_color_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Exact color</span>}
                      {!!prefs.pattern_veining_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Pattern</span>}
                      {!!prefs.translucency_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Translucency</span>}
                      {!!prefs.exact_dimensions_matters && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px]">Exact dimensions</span>}
                    </div>
                  </div>
                </div>

                {/* Ledger summary */}
                {ledgerRows.length > 0 && (
                  <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Ledger: </span>
                    {ledgerRows.map((r, i) => (
                      <span key={i}>
                        {i > 0 && " · "}
                        {r.event_type.replace(/_/g, " ")} ${(r.amount_cents / 100).toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
