"use client";

import { useState } from "react";
import Link from "next/link";
import { EmailPreviewModal } from "../EmailPreviewModal";

export interface DelayOrder {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  order_status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  order_created: "Order Created", order_confirmed: "Confirmed",
  in_production: "In Production", polishing: "Polishing",
  quality_control: "Quality Control", certifying: "Certifying",
  inbound_shipping: "Inbound Shipping", outbound_shipping: "Outbound Shipping",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function OrderDelaysClient({ orders }: { orders: DelayOrder[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(orders.map((o) => o.id)));
  const [customMessage, setCustomMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll() {
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }

  const orderIds = [...selected];

  async function handlePreview() {
    if (orderIds.length === 0) { setError("Select at least one order."); return; }
    setError(null);
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/emails/order-delays?preview=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, customMessage: customMessage.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
      else setError(data.error ?? "Preview failed.");
    } finally { setPreviewing(false); }
  }

  async function handleSend() {
    if (orderIds.length === 0) { setError("Select at least one order."); return; }
    setError(null);
    if (!confirm(`Send delay notification to ${orderIds.length} order${orderIds.length !== 1 ? "s" : ""}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/order-delays", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, customMessage: customMessage.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error ?? "Send failed.");
    } catch { setError("Network error."); }
    finally { setSending(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/custom-emails-admin" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Custom Emails
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Order Delays</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Notify customers with in-progress orders about a delay.
      </p>

      <div className="space-y-6">
        {/* Custom message */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Custom Message</h2>
          <p className="text-xs text-gray-400 mb-4">Leave blank to use the default luxury delay message.</p>
          <textarea
            rows={5}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder={"Dear [Name],\n\nWe wanted to reach out personally regarding your order…\n\n(Use double line breaks for paragraphs)"}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
          />
          <p className="text-xs text-gray-400 mt-2">The customer&apos;s first name will always appear in the greeting.</p>
        </section>

        {/* Order list */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Active Orders <span className="text-gray-300 dark:text-gray-600 font-normal">({orders.length})</span>
            </h2>
            <button type="button" onClick={toggleAll} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
              {selected.size === orders.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No active (non-delivered) orders.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <label key={o.id} className={`flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all ${selected.has(o.id) ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10" : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"}`}>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="accent-amber-600 w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {o.customer_name ?? "—"}
                      </span>
                      {o.order_number && (
                        <span className="text-xs text-gray-400">#{o.order_number}</span>
                      )}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        {STATUS_LABELS[o.order_status] ?? o.order_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {o.customer_email ?? "No email"} · {fmt(o.created_at)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Sent to <strong>{result.sent}</strong> customer{result.sent !== 1 ? "s" : ""}.{result.failed > 0 ? ` ${result.failed} failed.` : ""}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing || selected.size === 0}
            className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors disabled:opacity-50">
            {previewing ? "Loading…" : "Preview Email"}
          </button>
          <button type="button" onClick={handleSend} disabled={sending || selected.size === 0}
            className="flex-1 rounded-full bg-amber-600 hover:bg-amber-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? "Sending…" : `Send to ${selected.size} order${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {previewHtml && <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />}
    </div>
  );
}
