"use client";

import { useEffect, useState, useCallback } from "react";

interface ProductRow {
  product_id: string;
  product_name: string;
  category: string;
  status: string;
  imported_price_vnd: number | null;
  has_cost: boolean;
  cost: {
    id: string;
    vendor_id: string | null;
    purchase_price_original: number;
    purchase_currency: string;
    exchange_rate_to_usd: number;
    purchase_price_usd: number;
    import_cost_usd: number;
    certification_cost_usd: number;
    inbound_shipping_cost_usd: number;
    other_cost_usd: number;
    label_cost_usd: number;
    total_cogs_usd: number;
    notes: string | null;
  } | null;
}

interface Vendor {
  id: string;
  vendor_code: string;
  vendor_display_name: string | null;
}

type EditState = {
  vendor_id: string;
  purchase_price_original: string;
  purchase_currency: string;
  exchange_rate_to_usd: string;
  purchase_price_usd: string;
  import_cost_usd: string;
  certification_cost_usd: string;
  inbound_shipping_cost_usd: string;
  other_cost_usd: string;
  label_cost_usd: string;
  notes: string;
};

function emptyEdit(cost: ProductRow["cost"]): EditState {
  return {
    vendor_id:                  cost?.vendor_id ?? "",
    purchase_price_original:    String(cost?.purchase_price_original ?? ""),
    purchase_currency:          cost?.purchase_currency ?? "VND",
    exchange_rate_to_usd:       String(cost?.exchange_rate_to_usd ?? "26000"),
    purchase_price_usd:         String(cost?.purchase_price_usd ?? ""),
    import_cost_usd:            String(cost?.import_cost_usd ?? "0"),
    certification_cost_usd:     String(cost?.certification_cost_usd ?? "0"),
    inbound_shipping_cost_usd:  String(cost?.inbound_shipping_cost_usd ?? "0"),
    other_cost_usd:             String(cost?.other_cost_usd ?? "0"),
    label_cost_usd:             String(cost?.label_cost_usd ?? "0"),
    notes:                      cost?.notes ?? "",
  };
}

export function ProductCostsTab() {
  const [rows, setRows]         = useState<ProductRow[]>([]);
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing]   = useState<string | null>(null); // product_id
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/full-accounting/product-costs${missingOnly ? "?missing=1" : ""}`);
      const json = await res.json();
      setRows(json.products ?? []);
      setVendors(json.vendors ?? []);
    } finally {
      setLoading(false);
    }
  }, [missingOnly]);

  useEffect(() => { load(); }, [load]);

  function startEdit(row: ProductRow) {
    setEditing(row.product_id);
    setEditState(emptyEdit(row.cost));
    setMsg(null);
  }

  function cancelEdit() { setEditing(null); setEditState(null); }

  function updateField(field: keyof EditState, value: string) {
    setEditState((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  // Auto-compute purchase_price_usd from original + rate when currency is not USD
  function handleOriginalChange(v: string) {
    updateField("purchase_price_original", v);
    if (editState?.purchase_currency !== "USD") {
      const orig = parseFloat(v) || 0;
      const rate = parseFloat(editState?.exchange_rate_to_usd ?? "1") || 1;
      updateField("purchase_price_usd", (orig / rate).toFixed(2));
    }
  }

  async function save(productId: string) {
    if (!editState) return;
    setSaving(true);
    try {
      const row = rows.find((r) => r.product_id === productId);
      const isNew = !row?.cost;
      const payload = {
        product_id:                productId,
        vendor_id:                 editState.vendor_id || null,
        purchase_price_original:   parseFloat(editState.purchase_price_original) || 0,
        purchase_currency:         editState.purchase_currency,
        exchange_rate_to_usd:      parseFloat(editState.exchange_rate_to_usd) || 1,
        purchase_price_usd:        parseFloat(editState.purchase_price_usd) || 0,
        import_cost_usd:           parseFloat(editState.import_cost_usd) || 0,
        certification_cost_usd:    parseFloat(editState.certification_cost_usd) || 0,
        inbound_shipping_cost_usd: parseFloat(editState.inbound_shipping_cost_usd) || 0,
        other_cost_usd:            parseFloat(editState.other_cost_usd) || 0,
        label_cost_usd:            parseFloat(editState.label_cost_usd) || 0,
        notes:                     editState.notes || null,
      };

      let res: Response;
      if (isNew || !row?.cost?.id) {
        res = await fetch("/api/admin/full-accounting/product-costs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/full-accounting/product-costs/${row.cost.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setMsg("Saved");
        setEditing(null);
        setEditState(null);
        load();
      } else {
        const json = await res.json();
        setMsg(`Error: ${json.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const missingCount = rows.filter((r) => !r.has_cost).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)}
            className="rounded border-gray-300 text-emerald-600" />
          Show missing only
        </label>
        {missingCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            {missingCount} products missing COGS
          </span>
        )}
        {msg && <span className="text-xs text-gray-500 ml-auto">{msg}</span>}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="pl-4 pr-3 py-3 text-left">Product</th>
                  <th className="px-3 py-3 text-left">Cat.</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Orig. Price</th>
                  <th className="px-3 py-3 text-left">Curr.</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3 text-right">Purch. USD</th>
                  <th className="px-3 py-3 text-right">Import</th>
                  <th className="px-3 py-3 text-right">Cert.</th>
                  <th className="px-3 py-3 text-right">Inbound Ship.</th>
                  <th className="px-3 py-3 text-right">Other</th>
                  <th className="px-3 py-3 text-right">Label</th>
                  <th className="px-3 py-3 text-right font-semibold">Total COGS</th>
                  <th className="px-3 py-3 text-left">Vendor</th>
                  <th className="pr-4 pl-3 py-3 text-left">Notes</th>
                  <th className="pr-4 pl-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {rows.map((row) => (
                  <tr key={row.product_id}
                    className={`${!row.has_cost ? "bg-amber-50/30 dark:bg-amber-900/5" : ""} hover:bg-gray-50 dark:hover:bg-gray-800/30`}>
                    {editing === row.product_id && editState ? (
                      // ── Edit row ───────────────────────────────────────────
                      <>
                        <td className="pl-4 pr-3 py-2" colSpan={3}>
                          <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">{row.product_name}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" value={editState.purchase_price_original}
                            onChange={(e) => handleOriginalChange(e.target.value)}
                            className="w-24 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={editState.purchase_currency}
                            onChange={(e) => updateField("purchase_currency", e.target.value)}
                            className="text-xs border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-white dark:bg-gray-800">
                            {["VND", "USD", "CNY", "EUR", "HKD"].map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="1" value={editState.exchange_rate_to_usd}
                            onChange={(e) => updateField("exchange_rate_to_usd", e.target.value)}
                            className="w-20 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-right" />
                        </td>
                        {(["purchase_price_usd", "import_cost_usd", "certification_cost_usd", "inbound_shipping_cost_usd", "other_cost_usd"] as const).map((f) => (
                          <td key={f} className="px-2 py-1.5">
                            <input type="number" step="0.01" value={editState[f]}
                              onChange={(e) => updateField(f, e.target.value)}
                              className="w-20 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-right" />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          ${(
                            (parseFloat(editState.purchase_price_usd) || 0) +
                            (parseFloat(editState.import_cost_usd) || 0) +
                            (parseFloat(editState.certification_cost_usd) || 0) +
                            (parseFloat(editState.inbound_shipping_cost_usd) || 0) +
                            (parseFloat(editState.other_cost_usd) || 0)
                          ).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" value={editState.label_cost_usd}
                            onChange={(e) => updateField("label_cost_usd", e.target.value)}
                            className="w-20 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={editState.vendor_id}
                            onChange={(e) => updateField("vendor_id", e.target.value)}
                            className="text-xs border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-white dark:bg-gray-800 max-w-[120px]">
                            <option value="">— none —</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.vendor_code}{v.vendor_display_name ? ` – ${v.vendor_display_name}` : ""}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={editState.notes}
                            onChange={(e) => updateField("notes", e.target.value)}
                            className="w-32 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800" />
                        </td>
                        <td className="pr-4 pl-2 py-1.5">
                          <div className="flex gap-1.5">
                            <button onClick={() => save(row.product_id)} disabled={saving}
                              className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                              {saving ? "…" : "Save"}
                            </button>
                            <button onClick={cancelEdit} className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // ── Display row ────────────────────────────────────────
                      <>
                        <td className="pl-4 pr-3 py-2.5 text-gray-900 dark:text-gray-100 font-medium max-w-[200px] truncate" title={row.product_name}>
                          {row.product_name}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 capitalize">{row.category}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${row.status === "sold" ? "bg-gray-100 dark:bg-gray-800 text-gray-400" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"}`}>
                            {row.status}
                          </span>
                        </td>
                        {row.cost ? (
                          <>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{row.cost.purchase_price_original?.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-500">{row.cost.purchase_currency}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.exchange_rate_to_usd?.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">${row.cost.purchase_price_usd?.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.import_cost_usd > 0 ? `$${row.cost.import_cost_usd.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.certification_cost_usd > 0 ? `$${row.cost.certification_cost_usd.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.inbound_shipping_cost_usd > 0 ? `$${row.cost.inbound_shipping_cost_usd.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.other_cost_usd > 0 ? `$${row.cost.other_cost_usd.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{row.cost.label_cost_usd > 0 ? `$${row.cost.label_cost_usd.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">${row.cost.total_cogs_usd?.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">
                              {(row.cost as { acct_vendors?: { vendor_code: string } }).acct_vendors?.vendor_code ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[120px] truncate">{row.cost.notes ?? "—"}</td>
                          </>
                        ) : (
                          <td colSpan={12} className="px-3 py-2.5">
                            <span className="text-xs text-amber-600 dark:text-amber-400">⚠ No cost data — click Edit</span>
                          </td>
                        )}
                        <td className="pr-4 pl-3 py-2.5">
                          <button onClick={() => startEdit(row)}
                            className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                            {row.has_cost ? "Edit" : "Add"}
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
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Total COGS is auto-calculated as Purchase USD + Import + Certification + Inbound Shipping + Other.
        For VND prices, enter the original price and exchange rate — USD will be auto-filled.
      </p>
    </div>
  );
}
