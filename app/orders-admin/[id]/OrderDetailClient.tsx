"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/types/orders";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  product_id: string | null;
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

interface Order {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_snapshot: string | null;
  amount_total: number | null;
  currency: string;
  status: string;
  order_status: OrderStatus;
  source: string;
  order_type: "standard" | "custom";
  stripe_payment_intent_id: string | null;
  estimated_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
  shipping_address: ShippingAddress | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  order_created: "Order Created",
  order_confirmed: "Confirmed",
  in_production: "In Production",
  polishing: "Finishing & Polishing",
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
  in_production: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  polishing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  quality_control: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  certifying: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  inbound_shipping: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  outbound_shipping: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  order_cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ALL_STATUSES: OrderStatus[] = [
  "order_created", "order_confirmed", "in_production", "polishing",
  "quality_control", "certifying", "inbound_shipping", "outbound_shipping",
  "delivered", "order_cancelled",
];

const EMAILABLE_STATUSES = new Set<OrderStatus>([
  "order_confirmed", "in_production", "polishing", "quality_control", "certifying",
  "inbound_shipping", "outbound_shipping", "delivered", "order_cancelled",
]);

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────────────

export function OrderDetailClient({
  order: initialOrder,
  productImages,
}: {
  order: Order;
  productImages: Record<string, string>;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);

  const [editStatus, setEditStatus] = useState<OrderStatus>(order.order_status);
  const [editDelivery, setEditDelivery] = useState(order.estimated_delivery_date ?? "");
  const [editNotes, setEditNotes] = useState(order.notes ?? "");
  const [orderType, setOrderType] = useState<"standard" | "custom">(order.order_type);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("customer_changed_mind");
  const [restoreItems, setRestoreItems] = useState(false);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const statusChanged = editStatus !== order.order_status;
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: editStatus,
          estimatedDeliveryDate: editDelivery || null,
          notes: editNotes || null,
          orderType: orderType,
          sendEmail: statusChanged && sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Save failed"); return; }
      setOrder((prev) => ({ ...prev, ...data.order }));
      showToast("ok", statusChanged && sendEmail ? "Saved — customer notified" : "Saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setShowCancelModal(false);
    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: true, reason: cancelReason, restoreItems }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Cancel failed"); return; }
      setOrder((prev) => ({ ...prev, ...data.order }));
      setEditStatus("order_cancelled");
      showToast("ok", restoreItems ? "Order cancelled — items restored to available" : "Order cancelled — customer notified");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefund() {
    if (!confirm("Issue a full Stripe refund?")) return;
    setActionLoading("refund");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Refund failed"); return; }
      setOrder((prev) => ({ ...prev, ...data.order }));
      setEditStatus("order_cancelled");
      showToast("ok", "Refund issued via Stripe");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResend() {
    setActionLoading("resend");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/resend-confirmation`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Resend failed"); return; }
      showToast("ok", "Confirmation email resent");
    } finally {
      setActionLoading(null);
    }
  }

  const isCancelled = order.order_status === "order_cancelled";
  const total = order.order_items.reduce((s, i) => s + (i.line_total ?? (i.price_usd ?? 0) * i.quantity), 0);
  const displayTotal = (order.amount_total != null ? order.amount_total / 100 : total).toFixed(2);

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-center sm:text-left ${
          toast.type === "ok" ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 sm:py-8">
        {/* Back */}
        <button
          onClick={() => router.push("/orders-admin")}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-5 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Orders
        </button>

        {/* Order header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 truncate">
                {order.order_number ?? "No Order #"}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(order.created_at)} · {order.source}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${displayTotal}
              </p>
              <p className="text-xs text-gray-400 uppercase">{order.currency}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.order_status]}`}>
              {STATUS_LABELS[order.order_status]}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              order.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
              order.status === "refunded" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              {order.status}
            </span>
            {orderType === "custom" && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                Custom Order
              </span>
            )}
          </div>
        </div>

        {/* Two-column grid — management panel renders first in DOM (shown first on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

          {/* RIGHT column — Manage + Actions (order-first on mobile) */}
          <div className="lg:col-start-3 space-y-4 order-first lg:order-last">

            {/* Manage Order */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Manage Order</h2>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Order Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => {
                    const s = e.target.value as OrderStatus;
                    setEditStatus(s);
                    setSendEmail(EMAILABLE_STATUSES.has(s) && s !== order.order_status);
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={editDelivery}
                  onChange={(e) => setEditDelivery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {editDelivery && editDelivery !== (order.estimated_delivery_date ?? "") && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Customer will be emailed the new date on save.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Internal Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Admin-only notes…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Order type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Order Type</label>
                <select
                  value={orderType}
                  onChange={async (e) => {
                    const val = e.target.value as "standard" | "custom";
                    setOrderType(val);
                    await fetch(`/api/admin/orders/${order.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderType: val }),
                    });
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="standard">Standard Order</option>
                  <option value="custom">Custom Order</option>
                </select>
              </div>

              {EMAILABLE_STATUSES.has(editStatus) && editStatus !== order.order_status && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Notify customer via email</span>
                </label>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Actions</h2>

              <button
                onClick={handleResend}
                disabled={actionLoading === "resend"}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 text-gray-700 dark:text-gray-300 py-2.5 text-sm font-medium transition-colors"
              >
                {actionLoading === "resend" ? "Sending…" : "Resend Confirmation Email"}
              </button>

              {!isCancelled && order.stripe_payment_intent_id && (
                <button
                  onClick={handleRefund}
                  disabled={actionLoading === "refund" || order.status === "refunded"}
                  className="w-full rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 text-red-600 dark:text-red-400 py-2.5 text-sm font-medium transition-colors"
                >
                  {actionLoading === "refund" ? "Refunding…" : order.status === "refunded" ? "Already Refunded" : "Refund via Stripe"}
                </button>
              )}

              {!isCancelled && (
                <button
                  onClick={() => { setCancelReason("customer_changed_mind"); setRestoreItems(false); setShowCancelModal(true); }}
                  disabled={actionLoading === "cancel"}
                  className="w-full rounded-lg border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 text-red-600 dark:text-red-400 py-2.5 text-sm font-medium transition-colors"
                >
                  {actionLoading === "cancel" ? "Cancelling…" : "Cancel Order"}
                </button>
              )}
            </div>
          </div>

          {/* LEFT column — Items, Customer, Shipping (order-last on mobile) */}
          <div className="lg:col-span-2 space-y-4 order-last lg:order-first">

            {/* Items */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Items ({order.order_items.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {order.order_items.map((item) => {
                  const imgSrc = item.product_id ? productImages[item.product_id] : "";
                  const lineTotal = (item.line_total ?? (item.price_usd ?? 0) * item.quantity).toFixed(2);
                  return (
                    <div key={item.id} className="flex gap-3 px-4 py-3 items-center">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
                        {imgSrc ? (
                          <Image
                            src={imgSrc}
                            alt={item.product_name}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">{item.product_name}</p>
                        {item.option_label && <p className="text-xs text-gray-400 mt-0.5">{item.option_label}</p>}
                        {item.quantity > 1 && <p className="text-xs text-gray-400">×{item.quantity}</p>}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 shrink-0 ml-2">
                        ${lineTotal}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/60">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  ${displayTotal} {order.currency.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Customer */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer</h2>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.customer_name ?? "—"}</p>
                {order.customer_email && (
                  <a href={`mailto:${order.customer_email}`} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline block truncate">
                    {order.customer_email}
                  </a>
                )}
                {order.customer_phone_snapshot && (
                  <a href={`tel:${order.customer_phone_snapshot}`} className="text-sm text-gray-500 dark:text-gray-400 hover:underline block">
                    {order.customer_phone_snapshot}
                  </a>
                )}
                {order.stripe_payment_intent_id && (
                  <p className="text-xs text-gray-400 font-mono pt-1 truncate">pi: {order.stripe_payment_intent_id}</p>
                )}
              </div>
            </div>

            {/* Shipping address */}
            {order.shipping_address && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shipping Address</h2>
                <address className="not-italic text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                  {order.shipping_address.recipient_name && (
                    <p className="font-medium">{order.shipping_address.recipient_name}</p>
                  )}
                  <p>{order.shipping_address.address_line1}</p>
                  {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                  <p>{order.shipping_address.city}, {order.shipping_address.state_or_region} {order.shipping_address.postal_code}</p>
                  <p>{order.shipping_address.country}</p>
                </address>
              </div>
            )}

            {/* Public track page link */}
            {order.order_number && (
              <Link
                href={`/orders/${order.order_number}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View customer tracking page
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Cancel Order Modal */}
    {showCancelModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        onClick={(e) => { if (e.target === e.currentTarget) setShowCancelModal(false); }}
      >
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cancel Order</h2>
            <button
              onClick={() => setShowCancelModal(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="customer_changed_mind">Customer changed their mind</option>
                <option value="payment_not_completed">Customer did not complete payment on time</option>
                <option value="admin_mistake">Order created by mistake by admin</option>
                <option value="product_unavailable">Product no longer available</option>
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreItems}
                onChange={(e) => setRestoreItems(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Restore item(s) to <span className="font-medium">Available</span>
                <span className="block text-xs text-gray-400 mt-0.5">Re-lists the linked products as available in the shop.</span>
              </span>
            </label>
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setShowCancelModal(false)}
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Keep Order
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-semibold transition-colors"
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
