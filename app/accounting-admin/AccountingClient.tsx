"use client";

import { useEffect, useState } from "react";

interface MonthlyRow {
  month: string;
  revenue: number;
  itemRevenue: number;
  cogs: number;
  profit: number;
}
interface YearlyRow {
  year: string;
  revenue: number;
  itemRevenue: number;
  cogs: number;
  profit: number;
}
interface SourceRow { source: string; revenue: number; }

interface AccountingData {
  monthly: MonthlyRow[];
  yearly: YearlyRow[];
  bySource: SourceRow[];
  totalRevenue: number;
  totalItemRevenue: number;
  totalCogs: number;
  totalProfit: number;
  orderCount: number;
  hasCogs: boolean;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtUSDFull(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
function monthLabel(month: string) {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} '${year.slice(2)}`;
}

// Pure SVG bar chart with two series: item revenue (green) + COGS (red)
function BarChart({ data, showCogs }: { data: MonthlyRow[]; showCogs: boolean }) {
  const BAR_W     = showCogs ? 18 : 36;
  const BAR_GAP   = 2;
  const GROUP_GAP = 8;
  const H               = 200;
  const PADDING_TOP     = 16;
  const PADDING_BOTTOM  = 28;
  const PADDING_LEFT    = 64;
  const PADDING_RIGHT   = 12;

  const groupW   = showCogs ? BAR_W * 2 + BAR_GAP : BAR_W;
  const maxVal   = Math.max(...data.map((d) => d.itemRevenue), 1);
  const chartH   = H - PADDING_TOP - PADDING_BOTTOM;
  const totalW   = PADDING_LEFT + data.length * (groupW + GROUP_GAP) - GROUP_GAP + PADDING_RIGHT;

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxVal / tickCount) * i)
  );

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(totalW, 400)} height={H} className="block" aria-label="Monthly revenue chart">
        {ticks.map((tick) => {
          const y = PADDING_TOP + chartH - (tick / maxVal) * chartH;
          return (
            <g key={tick}>
              <line x1={PADDING_LEFT} x2={totalW - PADDING_RIGHT} y1={y} y2={y}
                stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
              <text x={PADDING_LEFT - 6} y={y + 4} textAnchor="end" fontSize={10}
                fill="currentColor" fillOpacity={0.45}>
                {fmtUSD(tick)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x     = PADDING_LEFT + i * (groupW + GROUP_GAP);
          const label = monthLabel(d.month);

          const revenueH = Math.max(2, (d.itemRevenue / maxVal) * chartH);
          const cogsH    = showCogs ? Math.max(2, (Math.min(d.cogs, d.itemRevenue) / maxVal) * chartH) : 0;

          return (
            <g key={d.month}>
              {/* Item revenue bar */}
              <rect x={x} y={PADDING_TOP + chartH - revenueH} width={BAR_W} height={revenueH}
                rx={3} className="fill-emerald-500 dark:fill-emerald-600" opacity={0.85}>
                <title>{label} — Item Revenue: {fmtUSDFull(d.itemRevenue)}</title>
              </rect>

              {/* COGS bar */}
              {showCogs && (
                <rect x={x + BAR_W + BAR_GAP} y={PADDING_TOP + chartH - cogsH}
                  width={BAR_W} height={cogsH} rx={3}
                  className="fill-rose-400 dark:fill-rose-500" opacity={0.75}>
                  <title>{label} — COGS: {fmtUSDFull(d.cogs)}</title>
                </rect>
              )}

              <text x={x + groupW / 2} y={H - PADDING_BOTTOM + 14} textAnchor="middle"
                fontSize={9} fill="currentColor" fillOpacity={0.5}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {showCogs && (
        <div className="flex items-center gap-5 mt-2 ml-2">
          <span className="flex items-center gap-1.5 text-[11px] sm:text-sm text-gray-500 dark:text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600 inline-block" />
            Item Revenue
          </span>
          <span className="flex items-center gap-1.5 text-[11px] sm:text-sm text-gray-500 dark:text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-rose-400 dark:bg-rose-500 inline-block" />
            COGS
          </span>
        </div>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  stripe:     "Stripe",
  paypal:     "PayPal",
  zelle:      "Zelle",
  venmo:      "Venmo/Cash",
  venmo_cash: "Venmo/Cash",
  manual:     "Manual",
  unknown:    "Other",
};

export function AccountingClient() {
  const [data, setData]               = useState<AccountingData | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/accounting")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        const thisYear = new Date().getFullYear().toString();
        if (d.yearly.some((y: YearlyRow) => y.year === thisYear)) {
          setSelectedYear(thisYear);
        } else if (d.yearly.length > 0) {
          setSelectedYear(d.yearly[d.yearly.length - 1].year);
        }
      })
      .catch(() => setError("Failed to load accounting data."));
  }, []);

  if (error) return <p className="text-red-500 px-6 py-8">{error}</p>;
  if (!data) return <div className="px-6 py-8 text-gray-400 dark:text-gray-500 text-sm">Loading…</div>;

  const years = data.yearly.map((y) => y.year);
  const filteredMonthly = selectedYear === "all"
    ? data.monthly
    : data.monthly.filter((m) => m.month.startsWith(selectedYear));

  const filtered = filteredMonthly.reduce(
    (acc, m) => {
      acc.revenue     += m.revenue;
      acc.itemRevenue += m.itemRevenue;
      acc.cogs        += m.cogs;
      acc.profit      += m.profit;
      return acc;
    },
    { revenue: 0, itemRevenue: 0, cogs: 0, profit: 0 }
  );

  const marginPct = filtered.itemRevenue > 0
    ? Math.round((filtered.profit / filtered.itemRevenue) * 100)
    : null;

  const showCogs = data.hasCogs;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header + year filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Accounting</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {data.orderCount} paid order{data.orderCount !== 1 ? "s" : ""} · excludes cancelled
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSelectedYear("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedYear === "all"
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}>
            All time
          </button>
          {years.map((y) => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedYear === y
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className={`grid gap-4 ${showCogs ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
          <p className="text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            {selectedYear === "all" ? "Total Collected" : `${selectedYear} Collected`}
          </p>
          <p className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300">
            {fmtUSDFull(filtered.revenue)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
          <p className="text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            Item Revenue
          </p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {fmtUSDFull(filtered.itemRevenue)}
          </p>
          <p className="text-[10px] sm:text-[14px] text-gray-400 mt-0.5">excl. shipping & fees</p>
        </div>

        {showCogs && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
            <p className="text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
              COGS
            </p>
            <p className="text-lg sm:text-xl font-bold text-rose-500 dark:text-rose-400">
              {fmtUSDFull(filtered.cogs)}
            </p>
            <p className="text-[10px] sm:text-[14px] text-gray-400 mt-0.5">import cost @ ₫26,000/USD</p>
          </div>
        )}

        {showCogs && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
            <p className="text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
              Gross Profit
            </p>
            <p className={`text-lg sm:text-xl font-bold ${filtered.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {fmtUSDFull(filtered.profit)}
            </p>
            {marginPct != null && (
              <p className="text-[10px] sm:text-[14px] text-gray-400 mt-0.5">{marginPct}% margin</p>
            )}
          </div>
        )}

        {!showCogs && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 col-span-2 sm:col-span-1">
            <p className="text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Avg / Month</p>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              {filteredMonthly.length > 0 ? fmtUSD(filtered.revenue / filteredMonthly.length) : "—"}
            </p>
          </div>
        )}
      </div>

      {/* Monthly chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-5">
        <h2 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Monthly Revenue{selectedYear !== "all" && ` — ${selectedYear}`}
        </h2>
        {filteredMonthly.length === 0
          ? <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">No data for this period.</p>
          : <BarChart data={filteredMonthly} showCogs={showCogs} />
        }
      </div>

      {/* Annual summary table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Annual Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] sm:text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="pb-2 pr-4 font-medium">Year</th>
                <th className="pb-2 pr-4 font-medium text-right">Total Collected</th>
                <th className="pb-2 pr-4 font-medium text-right">Item Revenue</th>
                {showCogs && <th className="pb-2 pr-4 font-medium text-right">COGS</th>}
                {showCogs && <th className="pb-2 pr-4 font-medium text-right">Gross Profit</th>}
                {showCogs && <th className="pb-2 font-medium text-right">Margin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {data.yearly.map((y) => {
                const margin = y.itemRevenue > 0
                  ? Math.round((y.profit / y.itemRevenue) * 100)
                  : null;
                return (
                  <tr key={y.year}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{y.year}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-400">{fmtUSDFull(y.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{fmtUSDFull(y.itemRevenue)}</td>
                    {showCogs && <td className="py-2.5 pr-4 text-right text-rose-500 dark:text-rose-400">{fmtUSDFull(y.cogs)}</td>}
                    {showCogs && (
                      <td className={`py-2.5 pr-4 text-right font-semibold ${y.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {fmtUSDFull(y.profit)}
                      </td>
                    )}
                    {showCogs && (
                      <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 text-xs">
                        {margin != null ? `${margin}%` : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                <td className="pt-2.5 pr-4 font-semibold text-gray-800 dark:text-gray-200">Total</td>
                <td className="pt-2.5 pr-4 text-right font-bold text-gray-700 dark:text-gray-300">{fmtUSDFull(data.totalRevenue)}</td>
                <td className="pt-2.5 pr-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmtUSDFull(data.totalItemRevenue)}</td>
                {showCogs && <td className="pt-2.5 pr-4 text-right font-bold text-rose-500 dark:text-rose-400">{fmtUSDFull(data.totalCogs)}</td>}
                {showCogs && (
                  <td className={`pt-2.5 pr-4 text-right font-bold ${data.totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {fmtUSDFull(data.totalProfit)}
                  </td>
                )}
                {showCogs && (
                  <td className="pt-2.5 text-right text-gray-400 text-xs">
                    {data.totalItemRevenue > 0
                      ? `${Math.round((data.totalProfit / data.totalItemRevenue) * 100)}%`
                      : "—"}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Revenue by source */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">By Payment Source</h2>
        <div className="space-y-3">
          {data.bySource.map((s) => {
            const pct = data.totalRevenue > 0 ? (s.revenue / data.totalRevenue) * 100 : 0;
            return (
              <div key={s.source}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">
                    {SOURCE_LABELS[s.source.toLowerCase()] ?? s.source}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    {fmtUSDFull(s.revenue)}
                    <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{Math.round(pct)}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-600"
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!showCogs && (
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          COGS and profit margin will appear once new orders are placed with import prices set.
        </p>
      )}

    </div>
  );
}
