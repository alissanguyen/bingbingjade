"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderStatus, OrderSource } from "@/types/orders";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderListItem {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_snapshot: string | null;
  amount_total: number | null;
  currency: string;
  status: string;
  order_status: OrderStatus;
  source: OrderSource;
  created_at: string;
  notes: string | null;
  item_count: number;
}

interface OrderItem {
  id: string;
  product_name: string;
  option_label: string | null;
  price_usd: number | null;
  quantity: number;
  line_total: number | null;
}

interface ShippingAddress {
  recipient_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_or_region: string;
  postal_code: string;
  country: string;
}

interface OrderDetail extends OrderListItem {
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  estimated_delivery_date: string | null;
  order_items: OrderItem[];
  shipping_address: ShippingAddress | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  order_created: "Order Created",
  order_confirmed: "Confirmed",
  quality_control: "Quality Control",
  certifying: "Certifying",
  inbound_shipping: "Inbound Shipping",
  outbound_shipping: "Outbound Shipping",
  delivered: "Delivered",
  order_cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  order_created: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  order_confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  quality_control: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  certifying: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  inbound_shipping: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  outbound_shipping: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  order_cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SOURCE_COLORS: Record<OrderSource, string> = {
  stripe: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  whatsapp: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
  cash: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  custom: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  admin: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const PAID_STATUS_COLORS: Record<string, string> = {
  paid: "text-emerald-600 dark:text-emerald-400",
  unpaid: "text-amber-600 dark:text-amber-400",
  refunded: "text-red-500 dark:text-red-400",
};

const ALL_STATUSES: OrderStatus[] = [
  "order_created", "order_confirmed", "quality_control",
  "certifying", "inbound_shipping", "outbound_shipping",
  "delivered", "order_cancelled",
];

// Statuses that have a customer-facing notification email
const EMAILABLE_STATUSES = new Set<OrderStatus>([
  "order_confirmed", "quality_control", "certifying",
  "inbound_shipping", "outbound_shipping", "delivered", "order_cancelled",
]);

function fmtAmount(cents: number | null, currency: string) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrdersAdminClient() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listLoading, setListLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit state
  const [editStatus, setEditStatus] = useState<OrderStatus>("order_confirmed");
  const [editDelivery, setEditDelivery] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 50;

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (p: number, q: string, s: string) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: String(LIMIT),
        ...(q ? { search: q } : {}),
        ...(s ? { status: s } : {}),
      });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      fetchOrders(1, search, statusFilter);
    }, 300);
  }, [search, statusFilter, fetchOrders]);

  useEffect(() => {
    fetchOrders(page, search, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Fetch detail ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/admin/orders/${selectedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetail(d.order ?? null);
        if (d.order) {
          setEditStatus(d.order.order_status);
          setEditDelivery(d.order.estimated_delivery_date ?? "");
          setEditNotes(d.order.notes ?? "");
          setSendEmail(EMAILABLE_STATUSES.has(d.order.order_status));
        }
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Save status/delivery/notes ──────────────────────────────────────────────
  async function handleSave() {
    if (!detail) return;
    setSaving(true);
    try {
      const statusChanged = editStatus !== detail.order_status;
      const res = await fetch(`/api/admin/orders/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: editStatus,
          estimatedDeliveryDate: editDelivery || null,
          notes: editNotes || null,
          sendEmail: statusChanged && sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Save failed"); return; }
      setDetail((prev) => prev ? { ...prev, ...data.order } : prev);
      setOrders((prev) => prev.map((o) => o.id === detail.id ? { ...o, order_status: editStatus, notes: editNotes || null } : o));
      showToast("ok", statusChanged && sendEmail ? "Saved and email sent" : "Saved");
    } finally {
      setSaving(false);
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!detail || !confirm("Cancel this order?")) return;
    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/admin/orders/${detail.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Cancel failed"); return; }
      setDetail((prev) => prev ? { ...prev, ...data.order } : prev);
      setEditStatus("order_cancelled");
      setOrders((prev) => prev.map((o) => o.id === detail.id ? { ...o, order_status: "order_cancelled" } : o));
      showToast("ok", sendEmail ? "Order cancelled and customer notified" : "Order cancelled");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Refund ──────────────────────────────────────────────────────────────────
  async function handleRefund() {
    if (!detail || !confirm("Issue a full Stripe refund for this order?")) return;
    setActionLoading("refund");
    try {
      const res = await fetch(`/api/admin/orders/${detail.id}/refund`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Refund failed"); return; }
      setDetail((prev) => prev ? { ...prev, ...data.order } : prev);
      setEditStatus("order_cancelled");
      setOrders((prev) => prev.map((o) => o.id === detail.id ? { ...o, order_status: "order_cancelled", status: "refunded" } : o));
      showToast("ok", "Refund issued via Stripe");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Resend confirmation ─────────────────────────────────────────────────────
  async function handleResend() {
    if (!detail) return;
    setActionLoading("resend");
    try {
      const res = await fetch(`/api/admin/orders/${detail.id}/resend-confirmation`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Resend failed"); return; }
      showToast("ok", "Confirmation email resent");
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const isCancelled = detail?.order_status === "order_cancelled";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === "ok"
            ? "bg-emerald-700 text-white"
            : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total} total orders</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="search"
            placeholder="Search order #, name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button
            onClick={() => fetchOrders(page, search, statusFilter)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Split layout */}
        <div className="flex gap-5 items-start">

          {/* Orders list */}
          <div className={`flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${selectedId ? "hidden lg:block" : ""}`}>
            {listLoading ? (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">Loading…</div>
            ) : orders.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-gray-400">No orders found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Order</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedId(order.id === selectedId ? null : order.id)}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                          order.id === selectedId ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {order.order_number ?? <span className="text-gray-400">—</span>}
                          <span className="block text-xs font-normal text-gray-400 font-sans">{order.item_count} item{order.item_count !== 1 ? "s" : ""}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="truncate text-gray-800 dark:text-gray-200 font-medium">{order.customer_name ?? "—"}</p>
                          <p className="truncate text-xs text-gray-400">{order.customer_email ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                          {fmtDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${PAID_STATUS_COLORS[order.status] ?? "text-gray-700"}`}>
                            {fmtAmount(order.amount_total, order.currency)}
                          </span>
                          <span className="block text-xs text-gray-400 capitalize">{order.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.order_status]}`}>
                            {STATUS_LABELS[order.order_status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[order.source]}`}>
                            {order.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedId && (
            <div className="w-full lg:w-[420px] shrink-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {detail?.order_number ?? "Order Detail"}
                </h2>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
              ) : detail ? (
                <div className="overflow-y-auto max-h-[calc(100vh-220px)]">

                  {/* Customer & meta */}
                  <section className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Customer</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{detail.customer_name ?? "—"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{detail.customer_email ?? "—"}</p>
                    {detail.customer_phone_snapshot && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{detail.customer_phone_snapshot}</p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PAID_STATUS_COLORS[detail.status] ?? ""}`}>
                        {detail.status}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[detail.source]}`}>
                        {detail.source}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDate(detail.created_at)}</span>
                    </div>
                    {detail.stripe_payment_intent_id && (
                      <p className="text-xs text-gray-400 font-mono truncate">pi: {detail.stripe_payment_intent_id}</p>
                    )}
                  </section>

                  {/* Shipping address */}
                  {detail.shipping_address && (
                    <section className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Shipping Address</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {detail.shipping_address.recipient_name && <span className="block font-medium">{detail.shipping_address.recipient_name}</span>}
                        <span className="block">{detail.shipping_address.address_line1}</span>
                        {detail.shipping_address.address_line2 && <span className="block">{detail.shipping_address.address_line2}</span>}
                        <span className="block">{detail.shipping_address.city}, {detail.shipping_address.state_or_region} {detail.shipping_address.postal_code}</span>
                        <span className="block">{detail.shipping_address.country}</span>
                      </p>
                    </section>
                  )}

                  {/* Order items */}
                  <section className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Items</p>
                    <div className="space-y-2">
                      {detail.order_items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{item.product_name}</p>
                            {item.option_label && <p className="text-xs text-gray-400">{item.option_label}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              ${(item.line_total ?? item.price_usd ?? 0).toFixed(2)}
                            </p>
                            {item.quantity > 1 && <p className="text-xs text-gray-400">×{item.quantity}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fmtAmount(detail.amount_total, detail.currency)}
                      </span>
                    </div>
                  </section>

                  {/* Edit section */}
                  <section className="px-5 py-4 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Manage Order</p>

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Order Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => {
                          const s = e.target.value as OrderStatus;
                          setEditStatus(s);
                          setSendEmail(EMAILABLE_STATUSES.has(s));
                        }}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>

                    {/* Estimated delivery */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Estimated Delivery Date</label>
                      <input
                        type="date"
                        value={editDelivery}
                        onChange={(e) => setEditDelivery(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Internal Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        placeholder="Notes visible to admin only…"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>

                    {/* Send email toggle */}
                    {EMAILABLE_STATUSES.has(editStatus) && editStatus !== detail.order_status && (
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendEmail}
                          onChange={(e) => setSendEmail(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Notify customer via email
                        </span>
                      </label>
                    )}

                    {/* Save */}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition-colors"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>

                    {/* Action buttons */}
                    <div className="pt-2 space-y-2">
                      <button
                        onClick={handleResend}
                        disabled={actionLoading === "resend"}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-gray-700 dark:text-gray-300 py-2.5 text-sm font-medium transition-colors"
                      >
                        {actionLoading === "resend" ? "Sending…" : "Resend Confirmation Email"}
                      </button>

                      {!isCancelled && detail.stripe_payment_intent_id && (
                        <button
                          onClick={handleRefund}
                          disabled={actionLoading === "refund" || detail.status === "refunded"}
                          className="w-full rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 text-red-600 dark:text-red-400 py-2.5 text-sm font-medium transition-colors"
                        >
                          {actionLoading === "refund" ? "Refunding…" : detail.status === "refunded" ? "Already Refunded" : "Refund via Stripe"}
                        </button>
                      )}

                      {!isCancelled && (
                        <button
                          onClick={handleCancel}
                          disabled={actionLoading === "cancel"}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-gray-500 dark:text-gray-400 py-2.5 text-sm font-medium transition-colors"
                        >
                          {actionLoading === "cancel" ? "Cancelling…" : "Cancel Order"}
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-gray-400">Order not found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
