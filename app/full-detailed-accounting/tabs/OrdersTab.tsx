"use client";

import { useEffect, useState, useCallback } from "react";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  source: string;
  order_status: string;
  amount_total: number;
  listed_subtotal: number;
  discount_applied: number;
  actual_item_revenue: number;
  shipping_charged: number;
  insurance_charged: number;
  sales_tax: number;
  // Payment ledger
  total_paid: number | null;
  payment_fee: number | null;
  net_received: number | null;
  amount_due: number | null;
  reconcile_status: string;
  payment_providers: string[];
  // Stripe raw (fallback)
  stripe_fee: number | null;
  stripe_net: number | null;
  refunded: number;
  has_stripe_data: boolean;
  total_cogs: number;
  missing_cogs: boolean;
  label_cost: number;
  insurance_cost: number;
  supplies_cost: number;
  total_fulfillment: number;
  estimated_profit: number | null;
}

function $$(n: number | null | undefined, blank = "—") {
  if (n == null) return blank;
  return n < 0
    ? `-$${Math.abs(n).toFixed(2)}`
    : `$${n.toFixed(2)}`;
}

const THIS_YEAR = new Date().getFullYear().toString();

export function OrdersTab() {
  const [orders, setOrders]   = useState<OrderRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]       = useState(`${THIS_YEAR}-01-01`);
  const [to,   setTo]         = useState(`${THIS_YEAR}-12-31`);
  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/full-accounting/orders?from=${from}&to=${to}&page=${p}&limit=${LIMIT}`
      );
      const json = await res.json();
      setOrders(json.orders ?? []);
      setTotal(json.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <button onClick={() => load(1)}
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors">
          Apply
        </button>
        <span className="text-sm text-gray-400 dark:text-gray-500 ml-auto">{total} orders</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No orders in range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {[
                    "Order #", "Date", "Customer", "Source",
                    "Listed Sub", "Discount", "Item Rev",
                    "Shipping", "Insurance", "Tax",
                    "Total Paid", "Amt Due", "Providers",
                    "Pay Fee", "Net Rcvd",
                    "Inv. Expense", "Label", "Insur.", "Supplies",
                    "Est. Profit",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {orders.map((o) => (
                  <tr key={o.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${o.missing_cogs ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                    <td className="pl-4 pr-3 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                      {o.order_number ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{o.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[140px] truncate" title={o.customer_email}>
                      {o.customer_name || o.customer_email || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {o.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{$$(o.listed_subtotal)}</td>
                    <td className="px-3 py-2 tabular-nums text-amber-600 dark:text-amber-400">
                      {o.discount_applied > 0 ? `-${$$(o.discount_applied)}` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-900 dark:text-gray-100">{$$(o.actual_item_revenue)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-400">{o.shipping_charged > 0 ? $$(o.shipping_charged) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-400">{o.insurance_charged > 0 ? $$(o.insurance_charged) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{o.sales_tax > 0 ? $$(o.sales_tax) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-gray-900 dark:text-gray-100">{$$(o.amount_total)}</td>
                    {/* Payment ledger columns */}
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {o.total_paid != null
                        ? <span className={o.reconcile_status === "paid" ? "text-emerald-700 dark:text-emerald-400" : o.reconcile_status === "partial" ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}>{$$(o.total_paid)}</span>
                        : <span className="text-gray-300 dark:text-gray-600 text-xs">no payments</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {o.amount_due != null && Math.abs(o.amount_due) > 0.01
                        ? <span className={o.amount_due > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>{$$(o.amount_due)}</span>
                        : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {o.payment_providers.length > 0
                        ? <span className="text-gray-600 dark:text-gray-400 text-xs">{o.payment_providers.join(", ")}</span>
                        : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-amber-600 dark:text-amber-400">
                      {o.payment_fee != null
                        ? (o.payment_fee > 0 ? `-${$$(o.payment_fee)}` : "—")
                        : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-400">{$$(o.net_received)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {o.missing_cogs ? (
                        <span className="text-amber-600 dark:text-amber-400" title="Missing Inv. Expense for some items">
                          {o.total_cogs > 0 ? $$(o.total_cogs) : "⚠ missing"}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">{$$(o.total_cogs)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{o.label_cost > 0 ? $$(o.label_cost) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{o.insurance_cost > 0 ? $$(o.insurance_cost) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500">{$$(o.supplies_cost)}</td>
                    <td className="pr-4 pl-3 py-2 tabular-nums font-semibold">
                      {o.estimated_profit == null ? (
                        <span className="text-amber-500 text-xs">need inv. expense</span>
                      ) : (
                        <span className={o.estimated_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {$$(o.estimated_profit)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
            Next →
          </button>
        </div>
      )}

      {/* Legend */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        ⚠ Amber rows = missing inv. expense. "Total Paid" and "Amt Due" come from the Payments ledger — run Sync Stripe and/or add manual payments.
        Payment fee = sum of all provider fees. Supplies default to $20 if not entered.
      </p>
    </div>
  );
}
