"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, OrderSource } from "@/types/orders";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderListItem {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_total: number | null;
  currency: string;
  status: string;
  order_status: OrderStatus;
  source: OrderSource;
  created_at: string;
  item_count: number;
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

const SOURCE_LABELS: Record<OrderSource, string> = {
  stripe: "Stripe",
  whatsapp: "WhatsApp",
  cash: "Cash/Zelle",
  custom: "Custom",
  admin: "Admin",
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
  "order_created", "order_confirmed", "in_production", "polishing",
  "quality_control", "certifying", "inbound_shipping", "outbound_shipping",
  "delivered", "order_cancelled",
];

function fmtAmount(cents: number | null, currency: string) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Create-order modal types ──────────────────────────────────────────────────

interface ProductOption {
  id: string;
  label: string | null;
  price_usd: number | null;
  status: string;
}

interface ProductChoice {
  id: string;
  name: string;
  status: string;
  price_display_usd: number | null;
  product_options: ProductOption[];
}

interface NewItem {
  productId: string;
  productName: string;
  optionId: string;
  optionLabel: string;
  price: string;
  quantity: string;
}

const EMPTY_ITEM: NewItem = { productId: "", productName: "", optionId: "", optionLabel: "", price: "", quantity: "1" };

const EMPTY_FORM = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  source: "cash" as OrderSource,
  paidStatus: "paid" as "paid" | "unpaid",
  orderStatus: "order_confirmed" as OrderStatus,
  currency: "usd",
  orderType: "standard" as "standard" | "custom",
  notes: "",
  estimatedDeliveryDate: "",
  sendConfirmation: true,
  hasShipping: false,
  shipRecipient: "",
  shipLine1: "",
  shipLine2: "",
  shipCity: "",
  shipState: "",
  shipPostal: "",
  shipCountry: "US",
};

// ── Component ────────────────────────────────────────────────────────────────

export function OrdersAdminClient() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listLoading, setListLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<NewItem[]>([{ ...EMPTY_ITEM }]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<ProductChoice[]>([]);
  const [activeCombobox, setActiveCombobox] = useState<number | null>(null);

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
    searchRef.current = setTimeout(() => { setPage(1); fetchOrders(1, search, statusFilter); }, 300);
  }, [search, statusFilter, fetchOrders]);

  useEffect(() => { fetchOrders(page, search, statusFilter); }, [page]); // eslint-disable-line

  const totalPages = Math.ceil(total / LIMIT);

  // ── Load products for combobox ──────────────────────────────────────────────
  useEffect(() => {
    if (!showCreate || allProducts.length > 0) return;
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((d) => setAllProducts(d.products ?? []))
      .catch(() => {});
  }, [showCreate]); // eslint-disable-line

  // ── Create order ────────────────────────────────────────────────────────────
  function setField<K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function updateItem(i: number, k: keyof NewItem, v: string) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const parsedItems = items.map((i) => ({
      productName: i.productName.trim(),
      optionLabel: i.optionLabel.trim() || undefined,
      price: parseFloat(i.price) || 0,
      quantity: parseInt(i.quantity) || 1,
      ...(i.productId ? { productId: i.productId } : {}),
      ...(i.optionId ? { optionId: i.optionId } : {}),
    }));

    const body: Record<string, unknown> = {
      source: form.source,
      paidStatus: form.paidStatus,
      currency: form.currency,
      orderType: form.orderType,
      items: parsedItems,
      ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
      ...(form.customerEmail.trim() ? { customerEmail: form.customerEmail.trim() } : {}),
      ...(form.customerPhone.trim() ? { customerPhone: form.customerPhone.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.estimatedDeliveryDate ? { estimatedDeliveryDate: form.estimatedDeliveryDate } : {}),
      orderStatus: form.orderStatus,
    };

    if (form.hasShipping && form.shipLine1.trim()) {
      body.shippingAddress = {
        recipientName: form.shipRecipient.trim() || undefined,
        line1: form.shipLine1.trim(),
        line2: form.shipLine2.trim() || undefined,
        city: form.shipCity.trim(),
        state: form.shipState.trim(),
        postal: form.shipPostal.trim(),
        country: form.shipCountry || "US",
      };
    }

    try {
      const res = await fetch("/api/admin/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Failed to create order"); return; }
      setShowCreate(false);
      router.push(`/orders-admin/${data.order.id}`);
    } finally {
      setCreating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} total</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }]); setCreateError(null); setShowCreate(true); }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            + New Order
          </button>
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
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <button
            onClick={() => fetchOrders(page, search, statusFilter)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {listLoading ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Order</th>
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
                      onClick={() => router.push(`/orders-admin/${order.id}`)}
                      className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {order.order_number ?? <span className="text-gray-400 font-sans text-xs">no number</span>}
                        <span className="block text-xs font-normal text-gray-400 font-sans">{order.item_count} item{order.item_count !== 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-gray-800 dark:text-gray-200 font-medium">{order.customer_name ?? "—"}</p>
                        <p className="truncate text-xs text-gray-400">{order.customer_email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(order.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-medium text-sm ${PAID_STATUS_COLORS[order.status] ?? "text-gray-700"}`}>
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
                          {SOURCE_LABELS[order.source]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create order modal ──────────────────────────────────────────────── */}
      {showCreate && (
        // On mobile: bottom sheet. On desktop: centered modal.
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center bg-black/50 sm:overflow-y-auto sm:py-8 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="w-full sm:max-w-2xl bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-none">

            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>

            {/* Sticky header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Order</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <form id="create-order-form" onSubmit={handleCreate} className="overflow-y-auto px-5 py-5 space-y-5 flex-1">

              {/* Customer */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Customer</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Name</label>
                    <input value={form.customerName} onChange={(e) => setField("customerName", e.target.value)}
                      placeholder="Full name" className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
                      <input type="email" inputMode="email" value={form.customerEmail} onChange={(e) => setField("customerEmail", e.target.value)}
                        placeholder="email@example.com" className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone</label>
                      <input type="tel" inputMode="tel" value={form.customerPhone} onChange={(e) => setField("customerPhone", e.target.value)}
                        placeholder="+1 555 000 0000" className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Order details */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Order Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Source <span className="text-red-500">*</span></label>
                    <select value={form.source} onChange={(e) => setField("source", e.target.value as OrderSource)} required
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="cash">Cash/Zelle</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="custom">Custom</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payment</label>
                    <select value={form.paidStatus} onChange={(e) => setField("paidStatus", e.target.value as "paid" | "unpaid")}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Status</label>
                    <select value={form.orderStatus} onChange={(e) => setField("orderStatus", e.target.value as OrderStatus)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {ALL_STATUSES.filter(s => s !== "order_cancelled").map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Currency</label>
                    <select value={form.currency} onChange={(e) => setField("currency", e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="usd">USD</option>
                      <option value="cad">CAD</option>
                      <option value="aud">AUD</option>
                      <option value="gbp">GBP</option>
                      <option value="sgd">SGD</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Est. Delivery Date</label>
                    <input type="date" value={form.estimatedDeliveryDate} onChange={(e) => setField("estimatedDeliveryDate", e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Order Type</label>
                    <select value={form.orderType} onChange={(e) => setField("orderType", e.target.value as "standard" | "custom")}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="standard">Standard Order</option>
                      <option value="custom">Custom Order</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Internal Notes</label>
                  <textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2}
                    placeholder="Notes visible to admin only…"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>
              </section>

              {/* Items */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Items <span className="text-red-500">*</span></h3>
                <div className="space-y-3">
                  {items.map((item, i) => {
                    const matched = allProducts.filter((p) =>
                      item.productName.trim() === "" || p.name.toLowerCase().includes(item.productName.toLowerCase())
                    );
                    const selectedProduct = allProducts.find((p) => p.id === item.productId) ?? null;
                    const availableOptions = selectedProduct?.product_options.filter((o) => o.status !== "sold") ?? [];

                    return (
                      <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-400">Item {i + 1}</span>
                          {items.length > 1 && (
                            <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Product combobox */}
                        <div className="relative">
                          <label className="block text-xs text-gray-400 mb-1">Product <span className="text-red-500">*</span></label>
                          <input
                            value={item.productName}
                            onChange={(e) => {
                              updateItem(i, "productName", e.target.value);
                              updateItem(i, "productId", "");
                              updateItem(i, "optionId", "");
                              updateItem(i, "optionLabel", "");
                              setActiveCombobox(i);
                            }}
                            onFocus={() => setActiveCombobox(i)}
                            onBlur={() => setTimeout(() => setActiveCombobox((c) => (c === i ? null : c)), 150)}
                            required
                            placeholder="Search by product name…"
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {activeCombobox === i && matched.length > 0 && (
                            <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-52 overflow-y-auto">
                              {matched.slice(0, 20).map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      const avail = p.product_options.filter((o) => o.status !== "sold");
                                      const firstPrice = avail[0]?.price_usd ?? p.price_display_usd;
                                      setItems((prev) => prev.map((it, idx) => {
                                        if (idx !== i) return it;
                                        return {
                                          ...it,
                                          productId: p.id,
                                          productName: p.name,
                                          optionId: "",
                                          optionLabel: "",
                                          price: firstPrice != null ? String(firstPrice) : it.price,
                                        };
                                      }));
                                      setActiveCombobox(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-between gap-2"
                                  >
                                    <span>{p.name}</span>
                                    {p.product_options.length > 0 && (
                                      <span className="text-xs text-gray-400 shrink-0">
                                        {p.product_options.filter((o) => o.status !== "sold").length} option{p.product_options.filter((o) => o.status !== "sold").length !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Option dropdown — shown when product has options */}
                        {availableOptions.length > 0 && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Option / Variant</label>
                            <select
                              value={item.optionId}
                              onChange={(e) => {
                                const opt = availableOptions.find((o) => o.id === e.target.value);
                                const resolvedPrice = opt?.price_usd ?? selectedProduct?.price_display_usd;
                                setItems((prev) => prev.map((it, idx) => {
                                  if (idx !== i) return it;
                                  return {
                                    ...it,
                                    optionId: opt?.id ?? "",
                                    optionLabel: opt?.label ?? "",
                                    price: resolvedPrice != null ? String(resolvedPrice) : it.price,
                                  };
                                }));
                              }}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">— select option —</option>
                              {availableOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label ?? "Untitled"}{o.price_usd != null ? ` — $${o.price_usd}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Price (USD) <span className="text-red-500">*</span></label>
                            <input type="number" inputMode="decimal" min="0" step="0.01" value={item.price}
                              onChange={(e) => updateItem(i, "price", e.target.value)} required
                              placeholder="0.00"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Qty</label>
                            <input type="number" inputMode="numeric" min="1" value={item.quantity}
                              onChange={(e) => updateItem(i, "quantity", e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                  className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                  + Add another item
                </button>
              </section>

              {/* Shipping */}
              <section>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={form.hasShipping} onChange={(e) => setField("hasShipping", e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Add Shipping Address</span>
                </label>
                {form.hasShipping && (
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Recipient Name</label>
                      <input value={form.shipRecipient} onChange={(e) => setField("shipRecipient", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address Line 1</label>
                      <input value={form.shipLine1} onChange={(e) => setField("shipLine1", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address Line 2</label>
                      <input value={form.shipLine2} onChange={(e) => setField("shipLine2", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">City</label>
                        <input value={form.shipCity} onChange={(e) => setField("shipCity", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">State / Region</label>
                        <input value={form.shipState} onChange={(e) => setField("shipState", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Postal Code</label>
                        <input value={form.shipPostal} onChange={(e) => setField("shipPostal", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Country</label>
                        <input value={form.shipCountry} onChange={(e) => setField("shipCountry", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Email toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer py-1">
                <input type="checkbox" checked={form.sendConfirmation} onChange={(e) => setField("sendConfirmation", e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Send confirmation email to customer</span>
              </label>

              {createError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{createError}</p>
              )}

              {/* Spacer so last field isn't hidden behind sticky footer */}
              <div className="h-2" />
            </form>

            {/* Sticky footer */}
            <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 bg-white dark:bg-gray-900">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="submit" form="create-order-form" disabled={creating}
                className="flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-3 text-sm font-semibold transition-colors">
                {creating ? "Creating…" : "Create Order"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
