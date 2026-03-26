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
  orders: LinkedOrder[];
  customer_emails: CustomerEmail[];
  customer_phones: CustomerPhone[];
  customer_addresses: CustomerAddress[];
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
                {emails.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{e.email}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{e.label}</span>
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
              {phones.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3 italic">No phone history recorded.</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {phones.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{p.phone}</p>
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
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
                      {a.recipient_name && <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{a.recipient_name}</p>}
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
