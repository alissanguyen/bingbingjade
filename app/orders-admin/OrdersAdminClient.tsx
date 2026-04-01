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
  cash: "Venmo/Cash",
  paypal: "PayPal",
  wire: "Wire Transfer",
  zelle: "Zelle",
  custom: "Custom",
  admin: "Admin",
};

const SOURCE_COLORS: Record<OrderSource, string> = {
  stripe: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  whatsapp: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
  cash: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  paypal: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  wire: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400",
  zelle: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
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

interface CustomerEmail  { id: string; email: string;  label: string; created_at: string; }
interface CustomerPhone  { id: string; phone: string;  label: string; created_at: string; }
interface CustomerAddress {
  id: string; recipient_name: string | null;
  address_line1: string; address_line2: string | null;
  city: string; state_or_region: string; postal_code: string; country: string;
}
interface ExistingCustomer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_emails:    CustomerEmail[];
  customer_phones:    CustomerPhone[];
  customer_addresses: CustomerAddress[];
}

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
  images: string[] | null;
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

interface AvailableCoupon {
  code: string;
  type: "subscriber_welcome" | "campaign";
  label: string;
  discountType?: string;
  discountValue?: number | null;
  expiresAt?: string | null;
}

const EMPTY_ITEM: NewItem = { productId: "", productName: "", optionId: "", optionLabel: "", price: "", quantity: "1" };

function productThumb(images: string[] | null): string {
  const first = images?.[0];
  if (!first) return "";
  if (first.startsWith("http")) return first;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/jade-images/${first}`;
}

const EMPTY_FORM = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  source: "zelle" as OrderSource,
  paidStatus: "paid" as "paid" | "unpaid",
  orderStatus: "order_confirmed" as OrderStatus,
  currency: "usd",
  orderType: "standard" as "standard" | "custom",
  notes: "",
  estimatedDeliveryDate: "",
  orderNumber: "BBJ-",
  orderDate: "",
  sendConfirmation: true,
  hasShipping: false,
  shipRecipient: "",
  shipLine1: "",
  shipLine2: "",
  shipCity: "",
  shipState: "",
  shipPostal: "",
  shipCountry: "US",
  feeShipping: "",
  feeTax: "",
  feePaypal: "",
  feeInsurance: "",
  feeDiscount: "",
  feeOther: "",
  feeOtherLabel: "",
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

  // Coupon selection
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [selectedCouponCode, setSelectedCouponCode] = useState("");
  const [couponsLoading, setCouponsLoading] = useState(false);
  const couponFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Existing customer selection
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("new");
  const [custSearch, setCustSearch] = useState("");
  const [custResults, setCustResults] = useState<ExistingCustomer[]>([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [selCustomer, setSelCustomer] = useState<ExistingCustomer | null>(null);
  const [selEmail, setSelEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selPhone, setSelPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [selAddressId, setSelAddressId] = useState(""); // existing address id or "new"
  const custSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Customer search (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return; }
    if (custSearchRef.current) clearTimeout(custSearchRef.current);
    custSearchRef.current = setTimeout(() => {
      fetch(`/api/admin/customers?search=${encodeURIComponent(custSearch)}&limit=10`)
        .then((r) => r.json())
        .then((d) => setCustResults(d.customers ?? []))
        .catch(() => {});
    }, 250);
  }, [custSearch]);

  // Derive the effective email to look up coupons for
  const effectiveEmail =
    customerMode === "existing"
      ? newEmail.trim() || (selEmail && selEmail !== "__new__" ? selEmail : "")
      : form.customerEmail.trim();

  useEffect(() => {
    if (!effectiveEmail) { setAvailableCoupons([]); setSelectedCouponCode(""); return; }
    if (couponFetchRef.current) clearTimeout(couponFetchRef.current);
    couponFetchRef.current = setTimeout(() => {
      setCouponsLoading(true);
      fetch(`/api/admin/coupons/available?email=${encodeURIComponent(effectiveEmail)}`)
        .then((r) => r.json())
        .then((d) => setAvailableCoupons(d.coupons ?? []))
        .catch(() => {})
        .finally(() => setCouponsLoading(false));
    }, 400);
  }, [effectiveEmail]); // eslint-disable-line

  function resetCustomerMode() {
    setCustomerMode("new");
    setCustSearch(""); setCustResults([]); setSelCustomer(null);
    setSelEmail(""); setNewEmail(""); setSelPhone(""); setNewPhone("");
    setSelAddressId("");
    setSelectedCouponCode(""); setAvailableCoupons([]);
  }

  async function selectExistingCustomer(c: ExistingCustomer) {
    // Fetch full profile (includes emails, phones, addresses)
    const res = await fetch(`/api/admin/customers/${c.id}`);
    const data = await res.json();
    const raw = data.customer ?? c;
    const full: ExistingCustomer = {
      ...raw,
      customer_emails:    raw.customer_emails    ?? [],
      customer_phones:    raw.customer_phones    ?? [],
      customer_addresses: raw.customer_addresses ?? [],
    };
    setSelCustomer(full);
    setCustSearch(full.customer_name);
    setCustResults([]);
    setShowCustDropdown(false);
    // Pre-select primary email/phone
    setSelEmail(full.customer_emails[0]?.email ?? full.customer_email ?? "");
    setNewEmail("");
    setSelPhone(full.customer_phones[0]?.phone ?? full.customer_phone ?? "");
    setNewPhone("");
    setSelAddressId(full.customer_addresses[0]?.id ?? "new");
    // Pre-fill form name
    setForm((f) => ({ ...f, customerName: full.customer_name }));
  }

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

    // Resolve customer email/phone — existing customer vs new
    const resolvedEmail = customerMode === "existing"
      ? (newEmail.trim() || selEmail)
      : form.customerEmail.trim();
    const resolvedPhone = customerMode === "existing"
      ? (newPhone.trim() || selPhone)
      : form.customerPhone.trim();

    // If existing customer added a new email/phone, save to their record first
    if (customerMode === "existing" && selCustomer) {
      if (newEmail.trim()) {
        await fetch(`/api/admin/customers/${selCustomer.id}/emails`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: newEmail.trim(), label: "Additional" }),
        });
      }
      if (newPhone.trim()) {
        await fetch(`/api/admin/customers/${selCustomer.id}/phones`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: newPhone.trim(), label: "Additional" }),
        });
      }
    }

    const fees: Record<string, number | string> = {};
    if (parseFloat(form.feeShipping) > 0) fees.shipping = parseFloat(form.feeShipping);
    if (parseFloat(form.feeTax) > 0) fees.tax = parseFloat(form.feeTax);
    if (parseFloat(form.feePaypal) > 0) fees.paypal = parseFloat(form.feePaypal);
    if (parseFloat(form.feeInsurance) > 0) fees.insurance = parseFloat(form.feeInsurance);
    if (parseFloat(form.feeDiscount) > 0) fees.discount = parseFloat(form.feeDiscount);
    if (parseFloat(form.feeOther) > 0) {
      fees.other = parseFloat(form.feeOther);
      if (form.feeOtherLabel.trim()) fees.otherLabel = form.feeOtherLabel.trim();
    }

    const body: Record<string, unknown> = {
      source: form.source,
      paidStatus: form.paidStatus,
      currency: form.currency,
      orderType: form.orderType,
      items: parsedItems,
      ...(Object.keys(fees).length > 0 ? { fees } : {}),
      ...(form.customerName.trim() ? { customerName: form.customerName.trim() } : {}),
      ...(resolvedEmail ? { customerEmail: resolvedEmail } : {}),
      ...(resolvedPhone ? { customerPhone: resolvedPhone } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.estimatedDeliveryDate ? { estimatedDeliveryDate: form.estimatedDeliveryDate } : {}),
      ...(form.orderNumber.trim() && form.orderNumber.trim() !== "BBJ-" ? { orderNumber: form.orderNumber.trim().toUpperCase() } : {}),
      ...(form.orderDate ? { orderDate: form.orderDate } : {}),
      orderStatus: form.orderStatus,
      ...(customerMode === "existing" && selCustomer ? { customerId: selCustomer.id } : {}),
    };

    // Shipping: existing saved address OR new address form
    const useExistingAddr = customerMode === "existing" && selCustomer && selAddressId && selAddressId !== "new" && selAddressId !== "";
    const submitNewAddress =
      (form.hasShipping || (customerMode === "existing" && selCustomer && selAddressId === "new"))
      && form.shipLine1.trim();
    if (useExistingAddr) {
      body.existingShippingAddressId = selAddressId;
    } else if (submitNewAddress) {
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

      // Mark coupon as used if one was selected
      if (selectedCouponCode && resolvedEmail) {
        await fetch("/api/admin/coupons/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: selectedCouponCode,
            customerEmail: resolvedEmail,
            orderRef: data.order.order_number,
          }),
        }).catch(() => {});
      }

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} total</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }]); setCreateError(null); resetCustomerMode(); setSelectedCouponCode(""); setAvailableCoupons([]); setShowCreate(true); }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors self-start sm:self-auto shrink-0"
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
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {/* Quick-filter pills */}
          <button
            onClick={() => { setStatusFilter(statusFilter === "delivered" ? "" : "delivered"); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              statusFilter === "delivered"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            Delivered
          </button>
          <button
            onClick={() => { setStatusFilter(statusFilter === "order_cancelled" ? "" : "order_cancelled"); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              statusFilter === "order_cancelled"
                ? "bg-red-600 text-white border-red-600"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            Cancelled
          </button>
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

                {/* Mode toggle */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-3 text-xs font-medium">
                  {(["new", "existing"] as const).map((m) => (
                    <button key={m} type="button"
                      onClick={() => { setCustomerMode(m); if (m === "new") resetCustomerMode(); }}
                      className={`flex-1 py-2 transition-colors ${customerMode === m ? "bg-emerald-700 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                      {m === "new" ? "New Customer" : "Existing Customer"}
                    </button>
                  ))}
                </div>

                {customerMode === "new" ? (
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
                ) : (
                  <div className="space-y-3">
                    {/* Customer search combobox */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Search customer <span className="text-red-500">*</span></label>
                      <input
                        value={custSearch}
                        onChange={(e) => { setCustSearch(e.target.value); setSelCustomer(null); setShowCustDropdown(true); }}
                        onFocus={() => setShowCustDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
                        placeholder="Name or email…"
                        autoComplete="off"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {showCustDropdown && custResults.length > 0 && (
                        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto">
                          {custResults.map((c) => (
                            <li key={c.id}>
                              <button type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectExistingCustomer(c)}
                                className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              >
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.customer_name || "(no name)"}</p>
                                <p className="text-xs text-gray-400">{c.customer_email}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {selCustomer && (
                      <>
                        {/* Selected customer summary */}
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                          ✓ {selCustomer.customer_name} · {(selCustomer.customer_emails ?? []).length} email{(selCustomer.customer_emails ?? []).length !== 1 ? "s" : ""} · {(selCustomer.customer_addresses ?? []).length} address{(selCustomer.customer_addresses ?? []).length !== 1 ? "es" : ""} on file
                        </div>

                        {/* Email picker */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email for this order</label>
                          <select value={selEmail} onChange={(e) => { setSelEmail(e.target.value); setNewEmail(""); }}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            {selCustomer.customer_emails.map((e) => (
                              <option key={e.id} value={e.email}>{e.email} ({e.label})</option>
                            ))}
                            {selCustomer.customer_emails.length === 0 && selCustomer.customer_email && (
                              <option value={selCustomer.customer_email}>{selCustomer.customer_email}</option>
                            )}
                            <option value="__new__">+ Add new email…</option>
                          </select>
                          {selEmail === "__new__" && (
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="new@example.com" autoFocus
                              className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          )}
                        </div>

                        {/* Phone picker */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Phone for this order</label>
                          <select value={selPhone} onChange={(e) => { setSelPhone(e.target.value); setNewPhone(""); }}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            {selCustomer.customer_phones.map((p) => (
                              <option key={p.id} value={p.phone}>{p.phone} ({p.label})</option>
                            ))}
                            {selCustomer.customer_phones.length === 0 && selCustomer.customer_phone && (
                              <option value={selCustomer.customer_phone}>{selCustomer.customer_phone}</option>
                            )}
                            <option value="">— none —</option>
                            <option value="__new__">+ Add new phone…</option>
                          </select>
                          {selPhone === "__new__" && (
                            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                              placeholder="+1 555 000 0000" autoFocus
                              className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Order details */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Order Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Source <span className="text-red-500">*</span></label>
                    <select value={form.source} onChange={(e) => setField("source", e.target.value as OrderSource)} required
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                      <option value="zelle">Zelle</option>
                      <option value="cash">Venmo/Cash</option>
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
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Order Number</label>
                    <input value={form.orderNumber} onChange={(e) => setField("orderNumber", e.target.value.toUpperCase())}
                      placeholder="BBJ-1232"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Order Date</label>
                    <input type="date" value={form.orderDate} onChange={(e) => setField("orderDate", e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
                    const availableOptions = selectedProduct?.product_options ?? [];

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
                                      const firstPrice = p.product_options[0]?.price_usd ?? p.price_display_usd;
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
                                    className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2.5"
                                  >
                                    {/* Thumbnail */}
                                    <div className="w-9 h-9 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                                      {productThumb(p.images) ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={productThumb(p.images)} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-base">🪨</div>
                                      )}
                                    </div>
                                    <span className="flex-1 truncate">{p.name}</span>
                                    {p.product_options.length > 0 && (
                                      <span className="text-xs text-gray-400 shrink-0">
                                        {p.product_options.length} option{p.product_options.length !== 1 ? "s" : ""}
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

              {/* Fees & Adjustments */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Fees &amp; Adjustments <span className="font-normal normal-case tracking-normal text-gray-300 dark:text-gray-600">(optional)</span></h3>

                {/* Coupon picker */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Coupon
                    {couponsLoading && <span className="ml-1.5 text-gray-400 font-normal">loading…</span>}
                  </label>
                  {!effectiveEmail ? (
                    <p className="text-xs text-gray-400 italic">Enter customer email above to see available coupons</p>
                  ) : !couponsLoading && availableCoupons.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No available coupons for this email</p>
                  ) : (
                    <select
                      value={selectedCouponCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedCouponCode(code);
                        if (code) {
                          const coupon = availableCoupons.find((c) => c.code === code);
                          // Auto-fill discount amount for fixed campaign coupons
                          if (coupon?.discountType === "fixed" && coupon.discountValue != null && !form.feeDiscount) {
                            setField("feeDiscount", String(coupon.discountValue));
                          }
                        } else {
                          // Clear discount if it was auto-filled
                          const prev = availableCoupons.find((c) => c.code === selectedCouponCode);
                          if (prev?.discountType === "fixed" && prev.discountValue != null && form.feeDiscount === String(prev.discountValue)) {
                            setField("feeDiscount", "");
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">— No coupon —</option>
                      {availableCoupons.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  )}
                  {selectedCouponCode && (() => {
                    const coupon = availableCoupons.find((c) => c.code === selectedCouponCode);
                    if (!coupon) return null;
                    const notes: string[] = [];
                    if (coupon.discountType === "tiered") notes.push("$10 off orders under $150, $20 off $150+");
                    if (coupon.discountType === "percent" && coupon.discountValue != null) notes.push(`Set discount to ${coupon.discountValue}% of items total`);
                    if (coupon.expiresAt) notes.push(`Expires ${new Date(coupon.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
                    if (notes.length === 0) return null;
                    return <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{notes.join(" · ")}</p>;
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Shipping</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feeShipping}
                        onChange={(e) => setField("feeShipping", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-7 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tax</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feeTax}
                        onChange={(e) => setField("feeTax", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-7 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Transaction Fee</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feePaypal}
                        onChange={(e) => setField("feePaypal", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-7 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Insurance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feeInsurance}
                        onChange={(e) => setField("feeInsurance", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-7 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Discount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">−$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feeDiscount ?? ""}
                        onChange={(e) => setField("feeDiscount", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-9 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Other Fee</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" inputMode="decimal" min="0" step="0.01" value={form.feeOther}
                        onChange={(e) => setField("feeOther", e.target.value)} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm pl-7 pr-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  {parseFloat(form.feeOther) > 0 && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Other Fee Label</label>
                      <input value={form.feeOtherLabel} onChange={(e) => setField("feeOtherLabel", e.target.value)}
                        placeholder="e.g. Insurance, Handling…"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Live total preview */}
                {(() => {
                  const itemsTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);
                  const feesTotal = (parseFloat(form.feeShipping) || 0) + (parseFloat(form.feeTax) || 0) + (parseFloat(form.feePaypal) || 0) + (parseFloat(form.feeInsurance) || 0) - (parseFloat(form.feeDiscount) || 0) + (parseFloat(form.feeOther) || 0);
                  const grand = itemsTotal + feesTotal;
                  if (grand === 0) return null;
                  return (
                    <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-3 py-2.5 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Items</span><span>${itemsTotal.toFixed(2)}</span>
                      </div>
                      {(parseFloat(form.feeShipping) || 0) > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>Shipping</span><span>+${parseFloat(form.feeShipping).toFixed(2)}</span></div>}
                      {(parseFloat(form.feeTax) || 0) > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>Tax</span><span>+${parseFloat(form.feeTax).toFixed(2)}</span></div>}
                      {(parseFloat(form.feePaypal) || 0) > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>Transaction Fee</span><span>+${parseFloat(form.feePaypal).toFixed(2)}</span></div>}
                      {(parseFloat(form.feeInsurance) || 0) > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>Insurance</span><span>+${parseFloat(form.feeInsurance).toFixed(2)}</span></div>}
                      {(parseFloat(form.feeDiscount) || 0) > 0 && <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400"><span>Discount</span><span>−${parseFloat(form.feeDiscount).toFixed(2)}</span></div>}
                      {(parseFloat(form.feeOther) || 0) > 0 && <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>{form.feeOtherLabel.trim() || "Other"}</span><span>+${parseFloat(form.feeOther).toFixed(2)}</span></div>}
                      <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-200 dark:border-gray-700">
                        <span>Order Total</span><span>${grand.toFixed(2)} {form.currency.toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })()}
              </section>

              {/* Shipping */}
              <section>
                {customerMode === "existing" && selCustomer ? (
                  <>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Shipping Address</h3>
                    <div className="space-y-3">
                      <select value={selAddressId} onChange={(e) => setSelAddressId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        {selCustomer.customer_addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {[a.recipient_name, a.address_line1, a.address_line2, `${a.city}, ${a.state_or_region} ${a.postal_code}`, a.country].filter(Boolean).join(" · ")}
                          </option>
                        ))}
                        <option value="new">+ Enter new address…</option>
                        <option value="">— No shipping —</option>
                      </select>
                      {selAddressId === "new" && (
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Recipient Name</label>
                            <input value={form.shipRecipient} onChange={(e) => setField("shipRecipient", e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-base sm:text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Address Line 1 <span className="text-red-500">*</span></label>
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
                          <p className="text-xs text-gray-400">This address will be saved to the customer record.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
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
