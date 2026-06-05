"use client";

import { useEffect, useState, useCallback } from "react";

interface QuarterRow {
  quarter: 1 | 2 | 3 | 4;
  year: number;
  label: string;
  range_label: string;
  gross_sales: number;
  discounts: number;
  tax_collected: number;
  cash_received: number;
  payment_fees: number;
  net_cash_received: number;
  cogs: number;
  fulfillment: number;
  fulfillment_ex_supplies: number;
  estimated_supplies_cost: number;
  actual_supplies_spend: number;
  supplies_delta: number;
  business_expenses: number;
  estimated_profit: number;
  tax_ready_profit: number;
}

interface OverviewData {
  // Revenue basis
  grossSales: number;
  grossRevenue: number;
  discountTotal: number;
  taxCollected: number;
  shippingRevenue: number;
  insuranceRevenue: number;
  txFeeTotal: number;
  // Cash basis
  cashReceived: number;
  paymentFeeTotal: number;
  netCashReceived: number;
  outstandingBalance: number;
  // Costs
  cogsTotal: number;
  fulfillmentCostTotal: number;
  fulfillmentCostExSupplies: number;
  businessExpenseTotal: number;
  // Supplies reconciliation
  defaultSuppliesPerOrder: number;
  estimatedSuppliesCost: number;
  actualSuppliesSpend: number;
  suppliesDelta: number;
  suppliesDeltaPct: number | null;
  actualAvgSuppliesPerOrder: number;
  // Bottom line
  estimatedNetProfit: number;
  taxReadyProfit: number;
  // Order counts
  orderCount: number;
  paidOrderCount: number;
  unpaidOrderCount: number;
  partialOrderCount: number;
  // Time series
  monthly: {
    month: string;
    revenue: number;
    discount: number;
    tax: number;
    cashReceived: number;
    paymentFee: number;
    cogs: number;
    fulfillment: number;
    suppliesEstimate: number;
    profit: number;
    taxReadyProfit: number;
  }[];
  quarterly?: QuarterRow[];
  expenseByCategory: Record<string, number>;
}

function fmt(n: number) {
  return n < 0
    ? `-$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function StatCard({
  label, value, sub, color = "default",
}: {
  label: string; value: string; sub?: string;
  color?: "default" | "green" | "red" | "amber";
}) {
  const colors = {
    default: "text-gray-900 dark:text-gray-100",
    green:   "text-emerald-700 dark:text-emerald-400",
    red:     "text-red-600 dark:text-red-400",
    amber:   "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${colors[color]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

const THIS_YEAR = new Date().getFullYear();
const LAST_YEAR = THIS_YEAR - 1;

function detectFullYear(from: string, to: string): number | null {
  const fromMatch = from.match(/^(\d{4})-01-01$/);
  const toMatch   = to.match(  /^(\d{4})-12-31$/);
  if (fromMatch && toMatch && fromMatch[1] === toMatch[1]) return Number(fromMatch[1]);
  return null;
}

const PRESET_RANGES = [
  { label: String(THIS_YEAR), from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-12-31` },
  { label: String(LAST_YEAR), from: `${LAST_YEAR}-01-01`, to: `${LAST_YEAR}-12-31` },
  { label: "Q1", from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-03-31` },
  { label: "Q2", from: `${THIS_YEAR}-04-01`, to: `${THIS_YEAR}-06-30` },
  { label: "Q3", from: `${THIS_YEAR}-07-01`, to: `${THIS_YEAR}-09-30` },
  { label: "Q4", from: `${THIS_YEAR}-10-01`, to: `${THIS_YEAR}-12-31` },
];

// Derive a text recommendation from supplies reconciliation data
function suppliesRecommendation(
  actual: number, estimated: number, count: number, defaultPer: number,
): { text: string; action: string | null; newDefault: number | null } {
  if (count === 0 || estimated === 0) return { text: "No orders in period.", action: null, newDefault: null };
  const actualAvg  = actual / count;
  const deltaPct   = ((actual - estimated) / estimated) * 100;
  const rounded    = Math.round(actualAvg * 100) / 100;

  if (Math.abs(deltaPct) <= 5) {
    return {
      text: `Actual average is ${fmt(actualAvg)}/order — your ${fmt(defaultPer)}/order estimate is accurate.`,
      action: null, newDefault: null,
    };
  }
  if (actual > estimated) {
    return {
      text: `Actual average is ${fmt(actualAvg)}/order — your estimate may be too low. Consider updating to ${fmt(rounded)}/order.`,
      action: `Update default to ${fmt(rounded)}/order`,
      newDefault: rounded,
    };
  }
  return {
    text: `Actual average is ${fmt(actualAvg)}/order — your estimate may be too high. Consider lowering to ${fmt(rounded)}/order, or keep current estimate to account for bulk/prepaid supplies.`,
    action: `Update default to ${fmt(rounded)}/order`,
    newDefault: rounded,
  };
}

export function OverviewTab() {
  const [data, setData]           = useState<OverviewData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [from, setFrom]           = useState(`${THIS_YEAR}-01-01`);
  const [to,   setTo]             = useState(`${THIS_YEAR}-12-31`);
  const [updatingDefault, setUpdatingDefault] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const load = useCallback(async (f = from, t = to) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: f, to: t });
      const fullYear = detectFullYear(f, t);
      if (fullYear) params.set("year", String(fullYear));
      const res = await fetch(`/api/admin/full-accounting/overview?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(p: { from: string; to: string }) {
    setFrom(p.from);
    setTo(p.to);
    load(p.from, p.to);
  }

  async function updateDefaultSupplies(newDefault: number) {
    setUpdatingDefault(true);
    setUpdateMsg(null);
    try {
      const res = await fetch("/api/admin/full-accounting/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_supplies_cost_per_order: newDefault }),
      });
      if (res.ok) {
        setUpdateMsg(`Default updated to ${fmt(newDefault)}/order. Reload to see recalculated estimates.`);
        load();
      } else {
        const j = await res.json();
        setUpdateMsg(`Error: ${j.error}`);
      }
    } catch {
      setUpdateMsg("Network error");
    } finally {
      setUpdatingDefault(false);
    }
  }

  const grossSales = data ? (data.grossSales ?? data.grossRevenue) : 0;

  return (
    <div className="space-y-6">
      {/* Time filter */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">From</label>
          <input
            type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">To</label>
          <input
            type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => load()}
            className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
          >
            Apply
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {PRESET_RANGES.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                from === p.from && to === p.to
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 py-12 text-center">Loading…</div>
      ) : !data ? (
        <div className="text-sm text-red-500 py-12 text-center">Failed to load</div>
      ) : (
        <>
          {/* Revenue cards */}
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Revenue (order basis)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Gross Sales"         value={fmt(grossSales)}             sub={`${data.orderCount} orders`} color="green" />
              <StatCard label="Discounts Given"     value={fmt(data.discountTotal)}      color="amber" />
              <StatCard label="Sales Tax Collected" value={fmt(data.taxCollected)}       sub="pass-through" />
              <StatCard label="Shipping Charged"      value={fmt(data.shippingRevenue)}  sub="collected from customers" />
              <StatCard label="Insurance Charged"   value={fmt(data.insuranceRevenue)} sub="collected from customers" />
              <StatCard label="Transaction Fees Charged" value={fmt(data.txFeeTotal ?? 0)} sub="passed through to customers" />
            </div>
          </div>

          {/* Cash cards */}
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Cash (payment basis)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Cash Received"       value={fmt(data.cashReceived)}       sub={`${data.paidOrderCount} fully paid`} color="green" />
              <StatCard label="Payment Fees"        value={fmt(data.paymentFeeTotal)}    color="amber" />
              <StatCard label="Net Cash Received"   value={fmt(data.netCashReceived)}    color={data.netCashReceived >= 0 ? "green" : "red"} />
              <StatCard
                label="Outstanding Balance"
                value={fmt(data.outstandingBalance)}
                sub={`${data.unpaidOrderCount} unpaid · ${data.partialOrderCount} partial`}
                color={data.outstandingBalance > 0 ? "amber" : "default"}
              />
            </div>
          </div>

          {/* Cost + profit cards */}
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Costs + bottom line</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatCard label="Inv. Expense"              value={fmt(data.cogsTotal)}            color="amber" />
              <StatCard label="Fulfillment Costs" value={fmt(data.fulfillmentCostTotal)} sub="incl. supplies estimate" color="amber" />
              <StatCard label="Business Expenses" value={fmt(data.businessExpenseTotal)} color="amber" />
              <StatCard
                label="Est. Profit (operational)"
                value={fmt(data.estimatedNetProfit)}
                sub="per-order supply estimates"
                color={data.estimatedNetProfit >= 0 ? "green" : "red"}
              />
              <StatCard
                label="Tax-Ready Profit"
                value={fmt(data.taxReadyProfit)}
                sub="actual supply expenses"
                color={data.taxReadyProfit >= 0 ? "green" : "red"}
              />
            </div>
          </div>

          {/* Supplies Estimate Accuracy card */}
          {(() => {
            const { estimatedSuppliesCost, actualSuppliesSpend, suppliesDelta, suppliesDeltaPct,
                    actualAvgSuppliesPerOrder, defaultSuppliesPerOrder, orderCount } = data;
            const rec = suppliesRecommendation(actualSuppliesSpend, estimatedSuppliesCost, orderCount, defaultSuppliesPerOrder);
            const absPct = suppliesDeltaPct != null ? Math.abs(suppliesDeltaPct) : 0;
            const warn = absPct > 20 && estimatedSuppliesCost > 0;
            const deltaColor = suppliesDelta === 0 ? "text-gray-500"
              : suppliesDelta > 0 ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400";

            return (
              <div className={`bg-white dark:bg-gray-900 rounded-xl border p-5 ${warn ? "border-amber-300 dark:border-amber-700" : "border-gray-200 dark:border-gray-800"}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Supplies Estimate Accuracy
                    </h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Compare per-order supply estimate vs. actual spend from business expenses (categories: supplies + shipping)
                    </p>
                  </div>
                  {warn && (
                    <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                      Review needed
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Orders shipped</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{orderCount}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Default estimate</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(defaultSuppliesPerOrder)}/order</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Est. supplies total</p>
                    <p className="text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{fmt(estimatedSuppliesCost)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Actual spend</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmt(actualSuppliesSpend)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{fmt(actualAvgSuppliesPerOrder)}/order avg</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Delta</p>
                    <p className={`text-lg font-semibold tabular-nums ${deltaColor}`}>{fmt(suppliesDelta)}</p>
                    {suppliesDeltaPct != null && (
                      <p className={`text-xs ${deltaColor}`}>{fmtPct(suppliesDeltaPct)}</p>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <p className={`text-sm font-medium mt-1 ${
                      absPct <= 5 ? "text-emerald-600 dark:text-emerald-400"
                        : absPct <= 20 ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {absPct <= 5 ? "Accurate" : absPct <= 20 ? "Moderate drift" : "Large drift"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{rec.text}</p>
                  {rec.action && rec.newDefault != null && (
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <button
                        onClick={() => updateDefaultSupplies(rec.newDefault!)}
                        disabled={updatingDefault}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
                      >
                        {updatingDefault ? "Updating…" : rec.action}
                      </button>
                      {updateMsg && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-right max-w-xs">{updateMsg}</p>
                      )}
                    </div>
                  )}
                </div>

                {actualSuppliesSpend === 0 && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    No shipping or supplies expenses logged yet. Add expenses with category &quot;shipping&quot; or &quot;supplies&quot; in the Expenses tab to enable accuracy tracking.
                  </p>
                )}
              </div>
            );
          })()}

          {/* P&L waterfall — dual basis */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">P&L Summary</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Two views of profit — choose <span className="font-medium">Tax-Ready</span> for filing, <span className="font-medium">Estimated</span> for day-to-day tracking.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Estimated (operational) */}
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  Estimated — operational
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Uses per-order supply estimates ({fmt(data.defaultSuppliesPerOrder)}/order). Excludes actual supply purchases from expenses to avoid double-counting.
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {[
                      { label: "Net Cash Received",   value: data.netCashReceived,          color: "" },
                      { label: "− Sales Tax",          value: -data.taxCollected,            color: "text-gray-400" },
                      { label: "− Inv. Expense",               value: -data.cogsTotal,               color: "text-amber-600 dark:text-amber-400" },
                      { label: "− Fulfillment (est.)", value: -data.fulfillmentCostTotal,    color: "text-amber-600 dark:text-amber-400" },
                      { label: "− Other Expenses",     value: -(data.businessExpenseTotal - data.actualSuppliesSpend), color: "text-amber-600 dark:text-amber-400" },
                      {
                        label: "= Est. Net Profit",
                        value: data.estimatedNetProfit,
                        color: data.estimatedNetProfit >= 0
                          ? "font-bold text-emerald-700 dark:text-emerald-400"
                          : "font-bold text-red-600 dark:text-red-400",
                      },
                    ].map((r) => (
                      <tr key={r.label}>
                        <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{r.label}</td>
                        <td className={`py-1.5 text-right tabular-nums ${r.color || "text-gray-900 dark:text-gray-100"}`}>{fmt(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax-ready (Option B) */}
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  Tax-Ready — actual expense basis
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Uses actual supply purchases from business expenses. Fulfillment excludes per-order estimates. Use for tax filing.
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {[
                      { label: "Net Cash Received",     value: data.netCashReceived,               color: "" },
                      { label: "− Sales Tax",            value: -data.taxCollected,                 color: "text-gray-400" },
                      { label: "− Inv. Expense",                 value: -data.cogsTotal,                    color: "text-amber-600 dark:text-amber-400" },
                      { label: "− Fulfillment (excl. supplies)", value: -data.fulfillmentCostExSupplies, color: "text-amber-600 dark:text-amber-400" },
                      { label: "− All Business Expenses", value: -data.businessExpenseTotal,         color: "text-amber-600 dark:text-amber-400" },
                      {
                        label: "= Tax-Ready Profit",
                        value: data.taxReadyProfit,
                        color: data.taxReadyProfit >= 0
                          ? "font-bold text-emerald-700 dark:text-emerald-400"
                          : "font-bold text-red-600 dark:text-red-400",
                      },
                    ].map((r) => (
                      <tr key={r.label}>
                        <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{r.label}</td>
                        <td className={`py-1.5 text-right tabular-nums ${r.color || "text-gray-900 dark:text-gray-100"}`}>{fmt(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quarterly breakdown (full year only) */}
          {data.quarterly && data.quarterly.length > 0 && (() => {
            const q = data.quarterly!;
            const totals = {
              gross_sales:            q.reduce((s, r) => s + r.gross_sales, 0),
              discounts:              q.reduce((s, r) => s + r.discounts, 0),
              tax_collected:          q.reduce((s, r) => s + r.tax_collected, 0),
              cash_received:          q.reduce((s, r) => s + r.cash_received, 0),
              payment_fees:           q.reduce((s, r) => s + r.payment_fees, 0),
              net_cash_received:      q.reduce((s, r) => s + r.net_cash_received, 0),
              cogs:                   q.reduce((s, r) => s + r.cogs, 0),
              fulfillment:            q.reduce((s, r) => s + r.fulfillment, 0),
              estimated_supplies_cost: q.reduce((s, r) => s + r.estimated_supplies_cost, 0),
              actual_supplies_spend:  q.reduce((s, r) => s + r.actual_supplies_spend, 0),
              business_expenses:      q.reduce((s, r) => s + r.business_expenses, 0),
              estimated_profit:       q.reduce((s, r) => s + r.estimated_profit, 0),
              tax_ready_profit:       q.reduce((s, r) => s + r.tax_ready_profit, 0),
            };
            return (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quarterly Summary — {q[0]?.year}</h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">IRS estimated tax reference</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {[
                          "Quarter", "Gross Sales", "Discounts", "Tax", "Cash Rcvd",
                          "Pay Fees", "Net Cash", "Inv. Expense", "Fulfillment",
                          "Est. Supplies", "Act. Supplies", "Bus. Exp.",
                          "Est. Profit", "Tax-Ready Profit",
                        ].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-right first:text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {q.map((row) => {
                        const supDelta = row.actual_supplies_spend - row.estimated_supplies_cost;
                        return (
                          <tr key={row.quarter} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                              <span className="font-mono">{row.label}</span>
                              <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">{row.range_label}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmt(row.gross_sales)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.discounts > 0 ? fmt(-row.discounts) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.tax_collected > 0 ? fmt(row.tax_collected) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(row.cash_received)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.payment_fees > 0 ? fmt(-row.payment_fees) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmt(row.net_cash_received)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.cogs > 0 ? fmt(-row.cogs) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.fulfillment > 0 ? fmt(-row.fulfillment) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-500">{row.estimated_supplies_cost > 0 ? fmt(row.estimated_supplies_cost) : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              <span className={supDelta > 0.01 ? "text-red-600 dark:text-red-400" : supDelta < -0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"}>
                                {row.actual_supplies_spend > 0 ? fmt(row.actual_supplies_spend) : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.business_expenses > 0 ? fmt(-row.business_expenses) : "—"}</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${row.estimated_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmt(row.estimated_profit)}
                            </td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${row.tax_ready_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmt(row.tax_ready_profit)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Full year totals */}
                      <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 font-semibold">
                        <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">Full Year</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmt(totals.gross_sales)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{totals.discounts > 0 ? fmt(-totals.discounts) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{totals.tax_collected > 0 ? fmt(totals.tax_collected) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(totals.cash_received)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{totals.payment_fees > 0 ? fmt(-totals.payment_fees) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmt(totals.net_cash_received)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{totals.cogs > 0 ? fmt(-totals.cogs) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{totals.fulfillment > 0 ? fmt(-totals.fulfillment) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-500">{totals.estimated_supplies_cost > 0 ? fmt(totals.estimated_supplies_cost) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{totals.actual_supplies_spend > 0 ? fmt(totals.actual_supplies_spend) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{totals.business_expenses > 0 ? fmt(-totals.business_expenses) : "—"}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${totals.estimated_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {fmt(totals.estimated_profit)}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${totals.tax_ready_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {fmt(totals.tax_ready_profit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    <span className="font-medium text-amber-500">Est. Supplies</span> = per-order estimates ·
                    <span className="font-medium text-gray-500"> Act. Supplies</span> = actual purchases from business expenses ·
                    <span className="font-medium text-emerald-600 dark:text-emerald-400"> Tax-Ready Profit</span> = uses actual supply expenses (Option B)
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Monthly table */}
          {data.monthly.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Monthly Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Month</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">Tax</th>
                      <th className="px-4 py-3 text-right">Cash Rcvd</th>
                      <th className="px-4 py-3 text-right">Pay Fee</th>
                      <th className="px-4 py-3 text-right">COGS</th>
                      <th className="px-4 py-3 text-right">Fulfillment</th>
                      <th className="px-4 py-3 text-right font-semibold">Est. Profit</th>
                      <th className="px-4 py-3 text-right font-semibold">Tax-Ready</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {data.monthly.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{m.month}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmt(m.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.discount > 0 ? fmt(-m.discount) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{m.tax > 0 ? fmt(m.tax) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{m.cashReceived > 0 ? fmt(m.cashReceived) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.paymentFee > 0 ? fmt(-m.paymentFee) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.cogs > 0 ? fmt(-m.cogs) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{m.fulfillment > 0 ? fmt(-m.fulfillment) : "—"}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${m.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {fmt(m.profit)}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${m.taxReadyProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {fmt(m.taxReadyProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expense by category */}
          {Object.keys(data.expenseByCategory).length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Expenses by Category</h2>
              <div className="space-y-2">
                {Object.entries(data.expenseByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-600 dark:text-gray-400">
                        {cat.replace(/_/g, " ")}
                      </span>
                      <span className="tabular-nums text-gray-900 dark:text-gray-100">{fmt(amt)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {(data.unpaidOrderCount > 0 || data.partialOrderCount > 0) && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-1">Payment reconciliation warnings</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {data.unpaidOrderCount > 0 && (
                  <li>{data.unpaidOrderCount} order{data.unpaidOrderCount !== 1 ? "s" : ""} have no recorded payment</li>
                )}
                {data.partialOrderCount > 0 && (
                  <li>{data.partialOrderCount} order{data.partialOrderCount !== 1 ? "s" : ""} are only partially paid — outstanding: {fmt(data.outstandingBalance)}</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
