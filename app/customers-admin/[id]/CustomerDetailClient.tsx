"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type CustomerStatus = "good_standing" | "frequent_client" | "high_risk";

interface CustomerEmail { id: string; email: string; label: string; created_at: string; }
interface CustomerPhone { id: string; phone: string; label: string; created_at: string; }
interface CustomerAddress {
  id: string;
  recipient_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_or_region: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

interface LinkedOrder {
  id: string;
  order_number: string | null;
  order_status: string;
  amount_total: number | null;
  currency: string;
  created_at: string;
}

interface AvailableOrder {
  id: string;
  order_number: string | null;
  order_status: string;
  amount_total: number | null;
  currency: string;
  created_at: string;
}

interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  number_of_orders: number;
  status: CustomerStatus;
  notes: string | null;
  created_at: string;
  referral_code: string | null;
  store_credit_balance: number | null;
  first_delivered_order_at: string | null;
  orders: LinkedOrder[];
  customer_emails: CustomerEmail[];
  customer_phones: CustomerPhone[];
  customer_addresses: CustomerAddress[];
  referral_stats: { pending: number; qualified: number; rewarded: number };
}

const STATUS_LABELS: Record<CustomerStatus, string> = {
  good_standing: "Good Standing",
  frequent_client: "Frequent Client",
  high_risk: "High Risk",
};

const STATUS_COLORS: Record<CustomerStatus, string> = {
  good_standing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  frequent_client: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  high_risk: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  order_created: "Created", order_confirmed: "Confirmed", in_production: "In Production",
  polishing: "Finishing & Polishing", quality_control: "Quality Control", certifying: "Certifying",
  inbound_shipping: "Inbound Shipping", outbound_shipping: "Outbound Shipping",
  delivered: "Delivered", order_cancelled: "Cancelled",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtAmount(cents: number | null, currency: string) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

export function CustomerDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Edit form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("good_standing");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Contact history
  const [emails, setEmails] = useState<CustomerEmail[]>([]);
  const [phones, setPhones] = useState<CustomerPhone[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  // Add email form
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmailVal, setNewEmailVal] = useState("");
  const [newEmailLabel, setNewEmailLabel] = useState("Additional");
  const [addingEmail, setAddingEmail] = useState(false);

  // Add phone form
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhoneVal, setNewPhoneVal] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("Mobile");
  const [addingPhone, setAddingPhone] = useState(false);

  // Add address form
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ recipientName: "", line1: "", line2: "", city: "", state: "", postal: "", country: "US" });
  const [addingAddr, setAddingAddr] = useState(false);

  // Referral invite
  const [sendingReferral, setSendingReferral] = useState(false);

  // Restrict customer modal
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [restricting, setRestricting] = useState(false);
  const [restrictForm, setRestrictForm] = useState({
    name: "", email: "", phone: "",
    address_line1: "", city: "", state: "", postal_code: "", country: "",
    reason: "manual_admin_review", severity: "blocked", internal_notes: "",
  });

  // Assign order
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.customer) {
          const c: Customer = d.customer;
          setCustomer(c);
          setName(c.customer_name ?? "");
          setEmail(c.customer_email ?? "");
          setPhone(c.customer_phone ?? "");
          setStatus(c.status);
          setNotes(c.notes ?? "");
          setEmails(c.customer_emails ?? []);
          setPhones(c.customer_phones ?? []);
          setAddresses(c.customer_addresses ?? []);
          fetchAvailableOrders(c.customer_email, c.orders.map((o) => o.id));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  function fetchAvailableOrders(customerEmail: string, alreadyLinkedIds: string[]) {
    setOrdersLoading(true);
    const params = new URLSearchParams({ search: customerEmail, limit: "100" });
    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((d) => {
        const orders: AvailableOrder[] = (d.orders ?? []).filter(
          (o: AvailableOrder) => !alreadyLinkedIds.includes(o.id)
        );
        setAvailableOrders(orders);
      })
      .finally(() => setOrdersLoading(false));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, customer_email: email, customer_phone: phone, status, notes }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Save failed"); return; }
      setCustomer((prev) => prev ? { ...prev, ...data.customer } : prev);
      showToast("ok", "Customer saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmailVal.trim()) return;
    setAddingEmail(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/emails`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmailVal.trim(), label: newEmailLabel.trim() || "Additional" }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add email"); return; }
      setEmails((prev) => [...prev, data.email]);
      setNewEmailVal(""); setNewEmailLabel("Additional"); setShowAddEmail(false);
      showToast("ok", "Email added");
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleAddPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhoneVal.trim()) return;
    setAddingPhone(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/phones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newPhoneVal.trim(), label: newPhoneLabel.trim() || "Mobile" }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add phone"); return; }
      setPhones((prev) => [...prev, data.phone]);
      setNewPhoneVal(""); setNewPhoneLabel("Mobile"); setShowAddPhone(false);
      showToast("ok", "Phone added");
    } finally {
      setAddingPhone(false);
    }
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddr.line1.trim() || !newAddr.city.trim() || !newAddr.state.trim() || !newAddr.postal.trim()) {
      showToast("err", "Line 1, city, state, and postal are required"); return;
    }
    setAddingAddr(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/addresses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: newAddr.recipientName.trim() || undefined, line1: newAddr.line1.trim(), line2: newAddr.line2.trim() || undefined, city: newAddr.city.trim(), state: newAddr.state.trim(), postal: newAddr.postal.trim(), country: newAddr.country.trim() || "US" }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add address"); return; }
      setAddresses((prev) => [...prev, data.address]);
      setNewAddr({ recipientName: "", line1: "", line2: "", city: "", state: "", postal: "", country: "US" });
      setShowAddAddr(false);
      showToast("ok", "Address added");
    } finally {
      setAddingAddr(false);
    }
  }

  async function handleSendReferralInvite() {
    setSendingReferral(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/send-referral-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to send email"); return; }
      showToast("ok", `Referral invite sent to ${customer?.customer_email}`);
    } finally {
      setSendingReferral(false);
    }
  }

  async function handleAssignOrder() {
    if (!selectedOrderId || !customer) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/assign-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrderId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Assign failed"); return; }

      const assigned = availableOrders.find((o) => o.id === selectedOrderId);
      if (assigned) {
        setCustomer((prev) => prev ? {
          ...prev,
          number_of_orders: prev.number_of_orders + 1,
          orders: [...prev.orders, { id: assigned.id, order_number: assigned.order_number, order_status: assigned.order_status, amount_total: assigned.amount_total, currency: assigned.currency, created_at: assigned.created_at }],
        } : prev);
        setAvailableOrders((prev) => prev.filter((o) => o.id !== selectedOrderId));
      }
      setSelectedOrderId("");
      showToast("ok", "Order assigned");
    } finally {
      setAssigning(false);
    }
  }

  function openRestrictModal() {
    if (!customer) return;
    const latestAddr = customer.customer_addresses?.[0];
    setRestrictForm({
      name: customer.customer_name ?? "",
      email: customer.customer_email ?? "",
      phone: customer.customer_phone ?? "",
      address_line1: latestAddr?.address_line1 ?? "",
      city: latestAddr?.city ?? "",
      state: latestAddr?.state_or_region ?? "",
      postal_code: latestAddr?.postal_code ?? "",
      country: latestAddr?.country ?? "",
      reason: "manual_admin_review",
      severity: "blocked",
      internal_notes: "",
    });
    setShowRestrictModal(true);
  }

  async function handleRestrict(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setRestricting(true);
    try {
      const res = await fetch("/api/admin/customer-restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.id,
          name: restrictForm.name || null,
          email: restrictForm.email || null,
          phone: restrictForm.phone || null,
          address_line1: restrictForm.address_line1 || null,
          city: restrictForm.city || null,
          state: restrictForm.state || null,
          postal_code: restrictForm.postal_code || null,
          country: restrictForm.country || null,
          reason: restrictForm.reason || null,
          severity: restrictForm.severity,
          internal_notes: restrictForm.internal_notes || null,
          status: "active",
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast("err", data.error ?? "Failed to add restriction"); return; }
      setShowRestrictModal(false);
      showToast("ok", "Customer restriction added");
    } finally {
      setRestricting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>;
  }
  if (!customer) {
    return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Customer not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === "ok" ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Restrict customer modal */}
      {showRestrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRestrictModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Restrict Customer</h2>
              <button onClick={() => setShowRestrictModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleRestrict} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Fill in the fields to match against during checkout. At minimum, one field must be present for a restriction to match.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input value={restrictForm.name} onChange={(e) => setRestrictForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Full name" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={restrictForm.email} onChange={(e) => setRestrictForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={restrictForm.phone} onChange={(e) => setRestrictForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="+1 555 000 0000" />
                </div>
                <div>
                  <label className={labelCls}>Address Line 1</label>
                  <input value={restrictForm.address_line1} onChange={(e) => setRestrictForm((p) => ({ ...p, address_line1: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input value={restrictForm.city} onChange={(e) => setRestrictForm((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>State / Region</label>
                  <input value={restrictForm.state} onChange={(e) => setRestrictForm((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Postal Code</label>
                  <input value={restrictForm.postal_code} onChange={(e) => setRestrictForm((p) => ({ ...p, postal_code: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input value={restrictForm.country} onChange={(e) => setRestrictForm((p) => ({ ...p, country: e.target.value }))} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Reason</label>
                  <select value={restrictForm.reason} onChange={(e) => setRestrictForm((p) => ({ ...p, reason: e.target.value }))} className={inputCls}>
                    <option value="expectation_mismatch">Expectation Mismatch</option>
                    <option value="chargeback_dispute_risk">Chargeback / Dispute Risk</option>
                    <option value="abusive_communication">Abusive Communication</option>
                    <option value="repeated_failed_sourcing">Repeated Failed Sourcing</option>
                    <option value="policy_abuse">Policy Abuse</option>
                    <option value="manual_admin_review">Manual Admin Review</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Severity</label>
                  <select value={restrictForm.severity} onChange={(e) => setRestrictForm((p) => ({ ...p, severity: e.target.value }))} className={inputCls}>
                    <option value="blocked">Blocked</option>
                    <option value="review">Review</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Internal Notes</label>
                <textarea value={restrictForm.internal_notes} onChange={(e) => setRestrictForm((p) => ({ ...p, internal_notes: e.target.value }))} rows={3}
                  placeholder="Internal notes (not visible to customer)…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowRestrictModal(false)}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 py-2.5 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={restricting}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition-colors">
                  {restricting ? "Saving…" : "Add Restriction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => router.push("/customers-admin")}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All Customers
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customer.customer_name || "Unnamed Customer"}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{customer.customer_email} · since {fmtDate(customer.created_at)}</p>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${STATUS_COLORS[customer.status]}`}>
            {STATUS_LABELS[customer.status]}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT: Edit form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Edit Customer</h2>

              <div>
                <label className={labelCls}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Primary Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Primary Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus)} className={inputCls}>
                  <option value="good_standing">Good Standing</option>
                  <option value="frequent_client">Frequent Client</option>
                  <option value="high_risk">High Risk</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>

              <button type="submit" disabled={saving}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-medium transition-colors">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </form>

            {/* Referral & Rewards */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Referral &amp; Rewards</h2>

              {/* Store credit balance */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400">Store Credit Balance</span>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  ${((customer.store_credit_balance ?? 0)).toFixed(2)}
                </span>
              </div>

              {/* Referral code */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400">Referral Code</span>
                {customer.referral_code ? (
                  <span className="font-mono text-sm font-bold tracking-widest text-gray-900 dark:text-gray-100 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-0.5">
                    {customer.referral_code}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">None yet — generated on first delivery</span>
                )}
              </div>

              {/* Referral stats */}
              <div className="grid grid-cols-3 gap-2 py-1">
                {[
                  { label: "Rewarded", value: customer.referral_stats?.rewarded ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Qualified", value: customer.referral_stats?.qualified ?? 0, color: "text-amber-600 dark:text-amber-400" },
                  { label: "Pending", value: customer.referral_stats?.pending ?? 0, color: "text-gray-500 dark:text-gray-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center rounded-lg bg-gray-50 dark:bg-gray-800 py-2">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Send referral invite */}
              <button
                onClick={handleSendReferralInvite}
                disabled={sendingReferral || !customer.referral_code}
                title={!customer.referral_code ? "No referral code yet — generated on first delivery" : ""}
                className="w-full rounded-lg border border-emerald-600 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed py-2.5 text-sm font-medium transition-colors"
              >
                {sendingReferral ? "Sending…" : "Send Referral Invite Email"}
              </button>
              {!customer.referral_code && (
                <p className="text-[11px] text-gray-400 text-center -mt-2">
                  Referral code is assigned automatically after their first order is delivered.
                </p>
              )}
            </div>

            {/* Restrict Customer */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-100 dark:border-red-900/30 p-5">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Customer Restriction</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Prevent this customer from completing checkout. Restriction is applied server-side and not disclosed to the customer.
              </p>
              <button
                onClick={openRestrictModal}
                className="w-full rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 py-2.5 text-sm font-medium transition-colors"
              >
                Restrict Customer
              </button>
              <a
                href="/restricted-customers"
                className="block text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-2 transition-colors"
              >
                View all restricted customers →
              </a>
            </div>
          </div>

          {/* RIGHT: Orders + contacts */}
          <div className="lg:col-span-3 space-y-4">

            {/* Linked orders */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Orders <span className="text-gray-400 font-normal">({customer.orders.length})</span>
                </h2>
              </div>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-5">No orders linked yet.</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {customer.orders.map((o) => (
                    <a key={o.id} href={`/orders-admin/${o.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
                      <div>
                        <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {o.order_number ?? <span className="font-sans font-normal text-gray-400 text-xs">no number</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(o.created_at)} · {ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmtAmount(o.amount_total, o.currency)}</p>
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-gray-300 group-hover:text-emerald-500 transition-colors mt-1">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Assign order */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Assign Order</h2>
              <p className="text-xs text-gray-400 mb-3">
                Orders matching <span className="font-medium text-gray-600 dark:text-gray-400">{customer.customer_email}</span> not yet linked.
              </p>
              {ordersLoading ? (
                <p className="text-xs text-gray-400">Loading orders…</p>
              ) : availableOrders.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No unlinked orders found for this email.</p>
              ) : (
                <div className="flex gap-2">
                  <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className={`flex-1 ${inputCls}`}>
                    <option value="">— select an order —</option>
                    {availableOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number ?? "(no number)"} · {fmtDate(o.created_at)} · {fmtAmount(o.amount_total, o.currency)}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAssignOrder} disabled={!selectedOrderId || assigning}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap">
                    {assigning ? "Assigning…" : "Assign"}
                  </button>
                </div>
              )}
            </div>

            {/* Email history */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Emails
                </h2>
                <button type="button" onClick={() => setShowAddEmail((v) => !v)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                  {showAddEmail ? "Cancel" : "+ Add"}
                </button>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {/* Primary email always shown */}
                {customer.customer_email && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{customer.customer_email}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">Primary</span>
                  </div>
                )}
                {emails.filter((e) => e.email !== customer.customer_email).map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{e.email}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{e.label}</span>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/customers/${id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customer_email: e.email }),
                          });
                          if (res.ok) {
                            setCustomer((prev) => prev ? { ...prev, customer_email: e.email } : prev);
                            setEmail(e.email);
                            showToast("ok", "Primary email updated");
                          } else {
                            showToast("err", "Failed to update primary email");
                          }
                        }}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        Set primary
                      </button>
                    </div>
                  </div>
                ))}
                {!customer.customer_email && emails.length === 0 && (
                  <p className="text-xs text-gray-400 px-4 py-3 italic">No emails recorded.</p>
                )}
              </div>
              {showAddEmail && (
                <form onSubmit={handleAddEmail} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex gap-2">
                    <input type="email" required value={newEmailVal} onChange={(e) => setNewEmailVal(e.target.value)}
                      placeholder="email@example.com" autoFocus
                      className={`flex-1 ${inputCls}`} />
                    <input value={newEmailLabel} onChange={(e) => setNewEmailLabel(e.target.value)}
                      placeholder="Label" className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <button type="submit" disabled={addingEmail || !newEmailVal.trim()}
                    className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white py-2 text-xs font-medium transition-colors">
                    {addingEmail ? "Adding…" : "Add Email"}
                  </button>
                </form>
              )}
            </div>

            {/* Phone history */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Phone Numbers <span className="text-gray-400 font-normal">({phones.length})</span>
                </h2>
                <button type="button" onClick={() => setShowAddPhone((v) => !v)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                  {showAddPhone ? "Cancel" : "+ Add"}
                </button>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {customer.customer_phone && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{customer.customer_phone}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">Primary</span>
                  </div>
                )}
                {phones.filter((p) => p.phone !== customer.customer_phone).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                    <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{p.phone}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{p.label}</span>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/customers/${id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customer_phone: p.phone }),
                          });
                          if (res.ok) {
                            setCustomer((prev) => prev ? { ...prev, customer_phone: p.phone } : prev);
                            setPhone(p.phone);
                            showToast("ok", "Primary phone updated");
                          } else {
                            showToast("err", "Failed to update primary phone");
                          }
                        }}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        Set primary
                      </button>
                    </div>
                  </div>
                ))}
                {!customer.customer_phone && phones.length === 0 && (
                  <p className="text-xs text-gray-400 px-4 py-3 italic">No phone history recorded.</p>
                )}
              </div>
              {showAddPhone && (
                <form onSubmit={handleAddPhone} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex gap-2">
                    <input type="tel" required value={newPhoneVal} onChange={(e) => setNewPhoneVal(e.target.value)}
                      placeholder="+1 555 000 0000" autoFocus className={`flex-1 ${inputCls}`} />
                    <input value={newPhoneLabel} onChange={(e) => setNewPhoneLabel(e.target.value)}
                      placeholder="Label" className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <button type="submit" disabled={addingPhone || !newPhoneVal.trim()}
                    className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white py-2 text-xs font-medium transition-colors">
                    {addingPhone ? "Adding…" : "Add Phone"}
                  </button>
                </form>
              )}
            </div>

            {/* Address history */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Addresses <span className="text-gray-400 font-normal">({addresses.length})</span>
                </h2>
                <button type="button" onClick={() => setShowAddAddr((v) => !v)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
                  {showAddAddr ? "Cancel" : "+ Add"}
                </button>
              </div>
              {addresses.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3 italic">No addresses on file.</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {addresses.map((a) => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="min-w-0">
                          {a.recipient_name && <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{a.recipient_name}</p>}
                        </div>
                        {a.is_default ? (
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 shrink-0">Primary</span>
                        ) : (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/admin/customers/${id}`, {
                                method: "PATCH", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ primaryAddressId: a.id }),
                              });
                              if (res.ok) {
                                setAddresses((prev) => prev.map((addr) => ({ ...addr, is_default: addr.id === a.id })));
                                showToast("ok", "Primary address updated");
                              } else {
                                showToast("err", "Failed to update primary address");
                              }
                            }}
                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                          >
                            Set primary
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ""}
                      </p>
                      <p className="text-xs text-gray-400">{a.city}, {a.state_or_region} {a.postal_code} · {a.country}</p>
                    </div>
                  ))}
                </div>
              )}
              {showAddAddr && (
                <form onSubmit={handleAddAddress} className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <input value={newAddr.recipientName} onChange={(e) => setNewAddr((a) => ({ ...a, recipientName: e.target.value }))}
                    placeholder="Recipient name (optional)" className={inputCls} />
                  <input required value={newAddr.line1} onChange={(e) => setNewAddr((a) => ({ ...a, line1: e.target.value }))}
                    placeholder="Address line 1 *" className={inputCls} />
                  <input value={newAddr.line2} onChange={(e) => setNewAddr((a) => ({ ...a, line2: e.target.value }))}
                    placeholder="Address line 2" className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input required value={newAddr.city} onChange={(e) => setNewAddr((a) => ({ ...a, city: e.target.value }))}
                      placeholder="City *" className={inputCls} />
                    <input required value={newAddr.state} onChange={(e) => setNewAddr((a) => ({ ...a, state: e.target.value }))}
                      placeholder="State / Region *" className={inputCls} />
                    <input required value={newAddr.postal} onChange={(e) => setNewAddr((a) => ({ ...a, postal: e.target.value }))}
                      placeholder="Postal code *" className={inputCls} />
                    <input value={newAddr.country} onChange={(e) => setNewAddr((a) => ({ ...a, country: e.target.value }))}
                      placeholder="Country" className={inputCls} />
                  </div>
                  <button type="submit" disabled={addingAddr}
                    className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white py-2 text-xs font-medium transition-colors">
                    {addingAddr ? "Adding…" : "Add Address"}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
