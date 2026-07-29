"use client";

import { useEffect, useState } from "react";

type Employee = { id: string; name: string };

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
  status: string;
  payment_method: string | null;
  scheduled_pay_date: string | null;
  actual_paid_date: string | null;
  approved_users: { full_name: string; email: string } | null;
};

const PAYMENT_METHODS = ["ACH", "ZELLE", "PAYPAL", "CHECK", "CASH", "OTHER"];

export function PayoutsClient({ employees }: { employees: Employee[] }) {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    periodStart: "",
    periodEnd: "",
    bonusAmount: "0",
    adjustmentAmount: "0",
    deductionAmount: "0",
    paymentMethod: "ZELLE",
    scheduledPayDate: "",
    privateAdminNotes: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((data) => setPayouts(data.payouts ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setError(null);
    if (!form.employeeId || !form.periodStart || !form.periodEnd) {
      setError("Employee, period start, and period end are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          bonusAmount: Number(form.bonusAmount) || 0,
          adjustmentAmount: Number(form.adjustmentAmount) || 0,
          deductionAmount: Number(form.deductionAmount) || 0,
          paymentMethod: form.paymentMethod,
          scheduledPayDate: form.scheduledPayDate || undefined,
          privateAdminNotes: form.privateAdminNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    const ref = prompt("Payment reference (optional):") ?? undefined;
    await fetch(`/api/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid", paymentReference: ref }),
    });
    load();
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this payout? Its credits will become available for a future payout.")) return;
    await fetch(`/api/admin/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    load();
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

  return (
    <div>
      <button
        onClick={() => setShowCreate((v) => !v)}
        className="mb-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
      >
        {showCreate ? "Cancel" : "+ Create Payout"}
      </button>

      {showCreate && (
        <div className="mb-8 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employee</label>
              <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className={inputCls}>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
              <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} className={inputCls}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Period Start</label>
              <input type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Period End</label>
              <input type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bonus</label>
              <input type="number" step="0.01" value={form.bonusAmount} onChange={(e) => setForm((f) => ({ ...f, bonusAmount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Adjustment</label>
              <input type="number" step="0.01" value={form.adjustmentAmount} onChange={(e) => setForm((f) => ({ ...f, adjustmentAmount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Deduction</label>
              <input type="number" step="0.01" value={form.deductionAmount} onChange={(e) => setForm((f) => ({ ...f, deductionAmount: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scheduled Pay Date</label>
              <input type="date" value={form.scheduledPayDate} onChange={(e) => setForm((f) => ({ ...f, scheduledPayDate: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Private Admin Notes</label>
            <textarea rows={2} value={form.privateAdminNotes} onChange={(e) => setForm((f) => ({ ...f, privateAdminNotes: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            {creating ? "Creating…" : "Create Payout"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : payouts.length === 0 ? (
        <p className="text-sm text-gray-400">No payouts yet.</p>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{p.approved_users?.full_name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {p.period_start} → {p.period_end} · {p.approved_listing_count} listings · ${Number(p.final_amount).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {p.status}
                  </span>
                  {p.status !== "PAID" && p.status !== "CANCELLED" && (
                    <>
                      <button onClick={() => handleMarkPaid(p.id)} className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                        Mark Paid
                      </button>
                      <button onClick={() => handleCancel(p.id)} className="text-xs font-medium text-red-500 hover:underline">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
