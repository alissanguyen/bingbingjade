"use client";

import { useState } from "react";

interface ExportConfig {
  label: string;
  type: string;
  description: string;
  needsDateRange: boolean;
}

const EXPORTS: ExportConfig[] = [
  {
    label: "Orders (Full Accounting)",
    type: "orders",
    description: "All orders with item subtotals, discounts, tax, payment fees, inv. expense, fulfillment costs, and estimated profit.",
    needsDateRange: true,
  },
  {
    label: "All Payments",
    type: "all-payments",
    description: "Every payment row (Stripe + manual) — amount, fee, net, provider, status, and linked order.",
    needsDateRange: true,
  },
  {
    label: "Manual Payments Only",
    type: "manual-payments",
    description: "PayPal, Zelle, bank transfer, cash, and other non-Stripe payments.",
    needsDateRange: true,
  },
  {
    label: "Stripe Payments",
    type: "stripe-payments",
    description: "Stripe payments synced from Checkout Sessions with fee and net breakdown.",
    needsDateRange: true,
  },
  {
    label: "Unreconciled Orders",
    type: "unreconciled",
    description: "Orders where recorded payments do not match the order total — amount due column included.",
    needsDateRange: true,
  },
  {
    label: "Monthly by Payment Provider",
    type: "monthly-by-provider",
    description: "Monthly payment volume grouped by provider (Stripe, Zelle, PayPal, etc.) with fees and net.",
    needsDateRange: true,
  },
  {
    label: "Product Costs",
    type: "product-costs",
    description: "All product purchase prices, import costs, certification, and total cost per product.",
    needsDateRange: false,
  },
  {
    label: "Fulfillment Costs",
    type: "fulfillment-costs",
    description: "Per-order label, insurance, supplies, and dropoff costs.",
    needsDateRange: true,
  },
  {
    label: "Business Expenses",
    type: "expenses",
    description: "All logged business expenses with category, deductible amount, and payment method.",
    needsDateRange: true,
  },
  {
    label: "Tax Summary",
    type: "tax-summary",
    description: "High-level revenue, discounts, tax collected, payment fees, and deductible expenses — for your accountant.",
    needsDateRange: true,
  },
  {
    label: "Quarterly Summary",
    type: "quarterly-summary",
    description: "Pre-computed Q1–Q4 P&L per year from the summaries cache. Run Recalculate first. Use for IRS estimated quarterly tax.",
    needsDateRange: false,
  },
  {
    label: "Monthly Summary",
    type: "monthly-summary",
    description: "Pre-computed monthly P&L from the summaries cache. Run Recalculate first.",
    needsDateRange: true,
  },
  {
    label: "Annual Summary",
    type: "annual-summary",
    description: "Pre-computed yearly P&L totals from the summaries cache. Run Recalculate first.",
    needsDateRange: false,
  },
];

const THIS_YEAR = new Date().getFullYear().toString();

export function ExportsTab() {
  const [from, setFrom]         = useState(`${THIS_YEAR}-01-01`);
  const [to, setTo]             = useState(`${THIS_YEAR}-12-31`);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(type: string) {
    setDownloading(type);
    try {
      const params = new URLSearchParams({ type });
      params.set("from", from);
      params.set("to", to);
      const res  = await fetch(`/api/admin/full-accounting/export?${params}`);
      const blob = await res.blob();
      const cd   = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${type}_export.csv`;

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export Data</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          All exports are CSV files. Set the date range below — it applies to date-ranged exports.
        </p>
      </div>

      {/* Date range */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wide">Date Range</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
          <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        </div>
        <div className="flex gap-2 mt-3">
          {[
            { label: `${THIS_YEAR}`, from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-12-31` },
            { label: `${Number(THIS_YEAR) - 1}`, from: `${Number(THIS_YEAR) - 1}-01-01`, to: `${Number(THIS_YEAR) - 1}-12-31` },
            { label: "Q1", from: `${THIS_YEAR}-01-01`, to: `${THIS_YEAR}-03-31` },
            { label: "Q2", from: `${THIS_YEAR}-04-01`, to: `${THIS_YEAR}-06-30` },
            { label: "Q3", from: `${THIS_YEAR}-07-01`, to: `${THIS_YEAR}-09-30` },
            { label: "Q4", from: `${THIS_YEAR}-10-01`, to: `${THIS_YEAR}-12-31` },
          ].map((p) => (
            <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); }}
              className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div className="space-y-3">
        {EXPORTS.map((exp) => (
          <div key={exp.type}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{exp.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{exp.description}</p>
              {exp.needsDateRange && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Range: {from} → {to}
                </p>
              )}
            </div>
            <button
              onClick={() => download(exp.type)}
              disabled={downloading != null}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              {downloading === exp.type ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0 1 14.93-2M20 15a8 8 0 0 1-14.93 2" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 3v12" />
                  </svg>
                  Download CSV
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        CSV files open in Excel, Google Sheets, or Numbers. For tax filing, share the Tax Summary with your accountant.
        Product cost export is not date-ranged — it reflects current cost data. Payment exports use the Payments ledger — run Sync Stripe first for complete data.
      </p>
    </div>
  );
}
