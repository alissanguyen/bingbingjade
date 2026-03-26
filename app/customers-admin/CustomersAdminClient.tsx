"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CustomerStatus = "good_standing" | "frequent_client" | "high_risk";

interface CustomerOrder {
  id: string;
  order_number: string;
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
  orders: CustomerOrder[];
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

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  status: "good_standing" as CustomerStatus,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CustomersAdminClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Add customer modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline editing state: { [id]: { status?, notes? } }
  const [editing, setEditing] = useState<Record<string, { notes: string; saving: boolean }>>({});

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchCustomers = useCallback(async (q: string, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(q ? { search: q } : {}),
        ...(s ? { status: s } : {}),
      });
      const res = await fetch(`/api/admin/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => fetchCustomers(search, statusFilter), 300);
  }, [search, statusFilter, fetchCustomers]);

  async function updateStatus(id: string, status: CustomerStatus) {
    setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    const res = await fetch(`/api/admin/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json();
      showToast("err", data.error ?? "Failed to update status");
      fetchCustomers(search, statusFilter); // revert
    } else {
      showToast("ok", "Status updated");
    }
  }

  function startEditNotes(c: Customer) {
    setEditing((prev) => ({ ...prev, [c.id]: { notes: c.notes ?? "", saving: false } }));
  }

  async function saveNotes(id: string) {
    const notes = editing[id]?.notes ?? "";
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    const res = await fetch(`/api/admin/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast("err", data.error ?? "Failed to save notes");
    } else {
      setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, notes: data.customer.notes } : c));
      showToast("ok", "Notes saved");
    }
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Failed to add customer"); return; }
      setShowAdd(false);
      setForm(EMPTY_FORM);
      fetchCustomers(search, statusFilter);
      showToast("ok", "Customer added");
    } finally {
      setAdding(false);
    }
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{customers.length} records</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setAddError(null); setShowAdd(true); }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            + Add Customer
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
          />
          {(["", "good_standing", "frequent_client", "high_risk"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? s === "" ? "bg-gray-700 text-white border-gray-700"
                    : s === "good_standing" ? "bg-blue-600 text-white border-blue-600"
                    : s === "frequent_client" ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-red-600 text-white border-red-600"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {s === "" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">No customers found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Orders</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-72">Notes</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Since</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {customers.map((c) => {
                    const isEditingNotes = c.id in editing;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        {/* Customer */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{c.customer_name || <span className="text-gray-400 italic">No name</span>}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.customer_email}</p>
                          {c.customer_phone && (
                            <p className="text-xs text-gray-400">{c.customer_phone}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <select
                            value={c.status}
                            onChange={(e) => updateStatus(c.id, e.target.value as CustomerStatus)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${STATUS_COLORS[c.status]}`}
                          >
                            <option value="good_standing">Good Standing</option>
                            <option value="frequent_client">Frequent Client</option>
                            <option value="high_risk">High Risk</option>
                          </select>
                        </td>

                        {/* Orders */}
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {c.number_of_orders} order{c.number_of_orders !== 1 ? "s" : ""}
                          </p>
                          {c.orders.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.orders.slice(0, 5).map((o) => (
                                <a
                                  key={o.id}
                                  href={`/orders-admin/${o.id}`}
                                  className="inline-block font-mono text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                  {o.order_number}
                                </a>
                              ))}
                              {c.orders.length > 5 && (
                                <span className="text-[10px] text-gray-400">+{c.orders.length - 5} more</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          {isEditingNotes ? (
                            <div className="flex flex-col gap-1.5">
                              <textarea
                                value={editing[c.id].notes}
                                onChange={(e) => setEditing((prev) => ({ ...prev, [c.id]: { ...prev[c.id], notes: e.target.value } }))}
                                rows={2}
                                autoFocus
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveNotes(c.id)}
                                  disabled={editing[c.id].saving}
                                  className="text-xs text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                  {editing[c.id].saving ? "Saving…" : "Save"}
                                </button>
                                <button
                                  onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[c.id]; return n; })}
                                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditNotes(c)}
                              className="text-left w-full group"
                            >
                              {c.notes ? (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {c.notes}
                                </p>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600 italic group-hover:text-emerald-500 transition-colors">Add note…</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                          {fmtDate(c.created_at)}
                        </td>

                        {/* Edit */}
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/customers-admin/${c.id}`}
                            className="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            Edit →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Customer</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAdd} className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CustomerStatus }))}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="good_standing">Good Standing</option>
                  <option value="frequent_client">Frequent Client</option>
                  <option value="high_risk">High Risk</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Internal notes…"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {addError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{addError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-semibold transition-colors"
                >
                  {adding ? "Adding…" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
