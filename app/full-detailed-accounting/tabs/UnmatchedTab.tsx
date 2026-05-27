"use client";

import { useEffect, useState } from "react";

interface UnmatchedData {
  stripe_unmatched: { id: string; bbj_order_code: string | null; payment_provider: string; amount_paid_usd: number; payment_date: string; payment_status: string; notes: string | null }[];
  manual_unlinked:  { id: string; bbj_order_code: string | null; payment_provider: string; amount_paid_usd: number; payment_date: string; payment_status: string; notes: string | null }[];
  unbalanced_orders: { id: string; order_number: string | null; customer_name: string | null; amount_total_usd: number; total_paid: number; amount_due: number; created_at: string; order_status: string }[];
  missing_cogs:        { id: string; order_number: string | null; customer_name: string | null; created_at: string; order_status: string }[];
  missing_fulfillment: { id: string; order_number: string | null; customer_name: string | null; amount_total_usd: number; created_at: string }[];
  counts: { stripe_unmatched: number; manual_unlinked: number; unbalanced_orders: number; missing_cogs: number; missing_fulfillment: number; total: number };
}

function $$(n: number | null | undefined) {
  if (n == null) return "—";
  return n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
}

function Section({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${count === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : color}`}>
            {count}
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {open && count > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800">{children}</div>
      )}
      {open && count === 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 text-sm text-emerald-600 dark:text-emerald-400">
          All clear — nothing to reconcile here.
        </div>
      )}
    </div>
  );
}

export function UnmatchedTab() {
  const [data, setData]       = useState<UnmatchedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/full-accounting/unmatched");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed"); return; }
      setData(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const th = "px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide";
  const td = "px-4 py-2.5 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reconciliation Issues</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            All items that need attention before the books balance. Scoped to last 12 months where applicable.
          </p>
        </div>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1.5">
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0 1 14.93-2M20 15a8 8 0 0 1-14.93 2" />
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-red-500">{error}</div>
      ) : !data ? null : (
        <>
          {/* Total issues badge */}
          {data.counts.total > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 font-medium">
              {data.counts.total} reconciliation {data.counts.total === 1 ? "issue" : "issues"} across all categories
            </div>
          )}
          {data.counts.total === 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              Books are balanced — no reconciliation issues found.
            </div>
          )}

          {/* 1. Stripe payments without order match */}
          <Section title="Stripe Payments Not Matched to Any Order" count={data.counts.stripe_unmatched} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className={th}>BBJ Code</th><th className={th}>Provider</th>
                  <th className={th}>Amount</th><th className={th}>Date</th>
                  <th className={th}>Status</th><th className={th}>Notes</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {data.stripe_unmatched.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`${td} font-mono text-gray-900 dark:text-gray-100`}>{p.bbj_order_code ?? <span className="text-gray-400">—</span>}</td>
                      <td className={td}>{p.payment_provider}</td>
                      <td className={`${td} tabular-nums font-medium`}>{$$(Number(p.amount_paid_usd))}</td>
                      <td className={`${td} text-gray-500`}>{p.payment_date?.slice(0, 10)}</td>
                      <td className={td}>{p.payment_status}</td>
                      <td className={`${td} text-gray-400 max-w-[200px] truncate`}>{p.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 2. Manual payments without order link */}
          <Section title="Manual Payments Without Order Link" count={data.counts.manual_unlinked} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className={th}>BBJ Code</th><th className={th}>Provider</th>
                  <th className={th}>Amount</th><th className={th}>Date</th><th className={th}>Notes</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {data.manual_unlinked.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`${td} font-mono text-gray-900 dark:text-gray-100`}>{p.bbj_order_code ?? <span className="text-gray-400">—</span>}</td>
                      <td className={td}>{p.payment_provider}</td>
                      <td className={`${td} tabular-nums font-medium`}>{$$(Number(p.amount_paid_usd))}</td>
                      <td className={`${td} text-gray-500`}>{p.payment_date?.slice(0, 10)}</td>
                      <td className={`${td} text-gray-400 max-w-[200px] truncate`}>{p.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 3. Unbalanced orders */}
          <Section title="Orders Where Total Paid ≠ Order Total" count={data.counts.unbalanced_orders} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className={th}>Order</th><th className={th}>Customer</th>
                  <th className={th}>Order Total</th><th className={th}>Total Paid</th>
                  <th className={th}>Amount Due</th><th className={th}>Date</th><th className={th}>Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {data.unbalanced_orders.map(o => (
                    <tr key={o.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${o.amount_due > 0 ? "" : "bg-amber-50/30 dark:bg-amber-900/5"}`}>
                      <td className={`${td} font-mono font-medium text-gray-900 dark:text-gray-100`}>{o.order_number ?? "—"}</td>
                      <td className={`${td} text-gray-700 dark:text-gray-300`}>{o.customer_name ?? "—"}</td>
                      <td className={`${td} tabular-nums`}>{$$(o.amount_total_usd)}</td>
                      <td className={`${td} tabular-nums text-emerald-700 dark:text-emerald-400`}>{$$(o.total_paid)}</td>
                      <td className={`${td} tabular-nums font-semibold ${o.amount_due > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {o.amount_due > 0 ? $$(o.amount_due) : `overpaid ${$$(-o.amount_due)}`}
                      </td>
                      <td className={`${td} text-gray-500`}>{o.created_at?.slice(0, 10)}</td>
                      <td className={td}>{o.order_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 4. Missing COGS */}
          <Section title="Orders Missing Inv. Expense" count={data.counts.missing_cogs} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className={th}>Order</th><th className={th}>Customer</th>
                  <th className={th}>Date</th><th className={th}>Status</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {data.missing_cogs.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`${td} font-mono font-medium text-gray-900 dark:text-gray-100`}>{o.order_number ?? "—"}</td>
                      <td className={`${td} text-gray-700 dark:text-gray-300`}>{o.customer_name ?? "—"}</td>
                      <td className={`${td} text-gray-500`}>{o.created_at?.slice(0, 10)}</td>
                      <td className={td}>{o.order_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-2 text-xs text-gray-400">Enter costs in the Product Costs tab to resolve.</p>
          </Section>

          {/* 5. Missing fulfillment costs */}
          <Section title="Orders Missing Fulfillment Costs" count={data.counts.missing_fulfillment} color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className={th}>Order</th><th className={th}>Customer</th>
                  <th className={th}>Order Total</th><th className={th}>Date</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {data.missing_fulfillment.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`${td} font-mono font-medium text-gray-900 dark:text-gray-100`}>{o.order_number ?? "—"}</td>
                      <td className={`${td} text-gray-700 dark:text-gray-300`}>{o.customer_name ?? "—"}</td>
                      <td className={`${td} tabular-nums text-gray-600 dark:text-gray-400`}>{$$(o.amount_total_usd)}</td>
                      <td className={`${td} text-gray-500`}>{o.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-2 text-xs text-gray-400">Enter costs in the Fulfillment tab. Supplies default to $20 if not entered.</p>
          </Section>
        </>
      )}
    </div>
  );
}
