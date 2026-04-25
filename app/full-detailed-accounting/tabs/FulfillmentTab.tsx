"use client";

import { useEffect, useState, useCallback } from "react";

interface FulfillmentRow {
  order_id: string;
  order_number: string | null;
  created_at: string;
  customer_name: string | null;
  order_status: string;
  amount_total: number;
  fulfillment_cost_id: string | null;
  label_cost: number;
  insurance_cost: number;
  supplies_cost: number;
  dropoff_cost: number;
  other_cost: number;
  notes: string | null;
  has_entry: boolean;
}

type EditState = {
  label_cost: string;
  insurance_cost: string;
  supplies_cost: string;
  dropoff_cost: string;
  other_cost: string;
  notes: string;
};

const THIS_YEAR = new Date().getFullYear().toString();

export function FulfillmentTab() {
  const [rows, setRows]     = useState<FulfillmentRow[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]     = useState(`${THIS_YEAR}-01-01`);
  const [to, setTo]         = useState(`${THIS_YEAR}-12-31`);
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<string | null>(null);
  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/full-accounting/fulfillment-costs?from=${from}&to=${to}&page=${p}&limit=${LIMIT}`);
      const json = await res.json();
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(1); }, [load]);

  function startEdit(row: FulfillmentRow) {
    setEditing(row.order_id);
    setEditState({
      label_cost:     String(row.label_cost),
      insurance_cost: String(row.insurance_cost),
      supplies_cost:  String(row.supplies_cost),
      dropoff_cost:   String(row.dropoff_cost),
      other_cost:     String(row.other_cost),
      notes:          row.notes ?? "",
    });
    setMsg(null);
  }

  async function save(orderId: string) {
    if (!editState) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/full-accounting/fulfillment-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id:                             orderId,
          label_cost_usd:                       parseFloat(editState.label_cost)     || 0,
          business_shipping_insurance_cost_usd: parseFloat(editState.insurance_cost) || 0,
          supplies_cost_usd:                    parseFloat(editState.supplies_cost)  || 20,
          dropoff_transport_cost_usd:           parseFloat(editState.dropoff_cost)   || 0,
          other_fulfillment_cost_usd:           parseFloat(editState.other_cost)     || 0,
          notes:                                editState.notes || null,
        }),
      });
      if (res.ok) {
        setEditing(null);
        setEditState(null);
        setMsg("Saved");
        load(page);
      } else {
        const json = await res.json();
        setMsg(`Error: ${json.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
        <button onClick={() => load(1)}
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg">
          Apply
        </button>
        {msg && <span className="text-xs text-gray-500 ml-auto">{msg}</span>}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pl-4 pr-3 py-3 text-left">Order</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-left">Customer</th>
                  <th className="px-3 py-3 text-right">Label</th>
                  <th className="px-3 py-3 text-right">Insurance</th>
                  <th className="px-3 py-3 text-right">Supplies</th>
                  <th className="px-3 py-3 text-right">Dropoff</th>
                  <th className="px-3 py-3 text-right">Other</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                  <th className="px-3 py-3 text-left">Notes</th>
                  <th className="pr-4 pl-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {rows.map((row) => (
                  <tr key={row.order_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="pl-4 pr-3 py-2.5 font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                      {row.order_number ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{row.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                      {row.customer_name ?? "—"}
                    </td>

                    {editing === row.order_id && editState ? (
                      <>
                        {(["label_cost", "insurance_cost", "supplies_cost", "dropoff_cost", "other_cost"] as const).map((f) => (
                          <td key={f} className="px-2 py-1.5">
                            <input type="number" step="0.01" value={editState[f]}
                              onChange={(e) => setEditState((prev) => prev ? { ...prev, [f]: e.target.value } : prev)}
                              className="w-20 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-right" />
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold text-gray-900 dark:text-gray-100">
                          ${(
                            (parseFloat(editState.label_cost) || 0) +
                            (parseFloat(editState.insurance_cost) || 0) +
                            (parseFloat(editState.supplies_cost) || 0) +
                            (parseFloat(editState.dropoff_cost) || 0) +
                            (parseFloat(editState.other_cost) || 0)
                          ).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={editState.notes}
                            onChange={(e) => setEditState((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                            className="w-28 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800" />
                        </td>
                        <td className="pr-4 pl-2 py-1.5">
                          <div className="flex gap-1.5">
                            <button onClick={() => save(row.order_id)} disabled={saving}
                              className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                              {saving ? "…" : "Save"}
                            </button>
                            <button onClick={() => { setEditing(null); setEditState(null); }}
                              className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.label_cost > 0 ? `$${row.label_cost.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.insurance_cost > 0 ? `$${row.insurance_cost.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">${row.supplies_cost.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.dropoff_cost > 0 ? `$${row.dropoff_cost.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{row.other_cost > 0 ? `$${row.other_cost.toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                          ${(row.label_cost + row.insurance_cost + row.supplies_cost + row.dropoff_cost + row.other_cost).toFixed(2)}
                          {!row.has_entry && <span className="ml-1 text-gray-400 text-xs">(est.)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[100px] truncate">{row.notes ?? "—"}</td>
                        <td className="pr-4 pl-3 py-2.5">
                          <button onClick={() => startEdit(row)}
                            className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                            Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Supplies cost defaults to $20 per order if not entered. "(est.)" = not yet recorded.
      </p>
    </div>
  );
}
