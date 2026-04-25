"use client";

import { useState } from "react";
import { OverviewTab } from "./tabs/OverviewTab";
import { OrdersTab } from "./tabs/OrdersTab";
import { ProductCostsTab } from "./tabs/ProductCostsTab";
import { VendorsTab } from "./tabs/VendorsTab";
import { FulfillmentTab } from "./tabs/FulfillmentTab";
import { ExpensesTab } from "./tabs/ExpensesTab";
import { ExportsTab } from "./tabs/ExportsTab";
import { PaymentsTab } from "./tabs/PaymentsTab";
import { UnmatchedTab } from "./tabs/UnmatchedTab";

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "payments",      label: "Payments" },
  { id: "unmatched",     label: "Unmatched" },
  { id: "orders",        label: "Orders" },
  { id: "product-costs", label: "Product Costs" },
  { id: "vendors",       label: "Vendors" },
  { id: "fulfillment",   label: "Fulfillment" },
  { id: "expenses",      label: "Expenses" },
  { id: "exports",       label: "Exports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AccountingDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [recalcing, setRecalcing] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/full-accounting/sync-stripe", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const parts = [`Synced ${json.synced} Stripe sessions`];
        if (json.backfilled > 0) parts.push(`${json.backfilled} orders backfilled`);
        if (json.unmatched  > 0) parts.push(`${json.unmatched} Stripe sessions unmatched`);
        setSyncMsg(parts.join(" · ") + ` — ${new Date(json.syncedAt).toLocaleString()}`);
      } else {
        setSyncMsg(`Error: ${json.error}`);
      }
    } catch {
      setSyncMsg("Network error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRecalc() {
    setRecalcing(true);
    setRecalcMsg(null);
    try {
      const res = await fetch("/api/admin/full-accounting/summary", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setRecalcMsg(`Recalculated ${json.periods} periods — ${new Date(json.calculatedAt).toLocaleString()}`);
      } else {
        setRecalcMsg(`Error: ${json.error}`);
      }
    } catch {
      setRecalcMsg("Network error");
    } finally {
      setRecalcing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Accounting</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Internal admin only — not indexed</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(syncMsg || recalcMsg) && (
              <span className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{recalcMsg ?? syncMsg}</span>
            )}
            <button
              onClick={handleRecalc}
              disabled={recalcing || syncing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${recalcing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M9 7h6" />
              </svg>
              {recalcing ? "Recalculating…" : "Recalculate"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || recalcing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0 1 14.93-2M20 15a8 8 0 0 1-14.93 2" />
              </svg>
              {syncing ? "Syncing…" : "Sync Stripe"}
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {tab === "overview"      && <OverviewTab />}
        {tab === "payments"      && <PaymentsTab />}
        {tab === "unmatched"     && <UnmatchedTab />}
        {tab === "orders"        && <OrdersTab />}
        {tab === "product-costs" && <ProductCostsTab />}
        {tab === "vendors"       && <VendorsTab />}
        {tab === "fulfillment"   && <FulfillmentTab />}
        {tab === "expenses"      && <ExpensesTab />}
        {tab === "exports"       && <ExportsTab />}
      </div>
    </div>
  );
}
