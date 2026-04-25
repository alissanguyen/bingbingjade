"use client";

import { useEffect, useState, useCallback } from "react";

interface Vendor {
  id: string;
  vendor_code: string;
  vendor_display_name: string | null;
  real_name: string | null;
  country: string | null;
  contact_info: string | null;
  notes: string | null;
  created_at: string;
}

const EMPTY_FORM = { vendor_code: "", vendor_display_name: "", real_name: "", country: "", contact_info: "", notes: "" };

export function VendorsTab() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editing, setEditing]   = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/full-accounting/acct-vendors");
    const json = await res.json();
    setVendors(json.vendors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMsg(null);
  }

  function startEdit(v: Vendor) {
    setEditing(v.id);
    setForm({
      vendor_code: v.vendor_code,
      vendor_display_name: v.vendor_display_name ?? "",
      real_name: v.real_name ?? "",
      country: v.country ?? "",
      contact_info: v.contact_info ?? "",
      notes: v.notes ?? "",
    });
    setShowForm(true);
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/full-accounting/acct-vendors/${editing}`
        : "/api/admin/full-accounting/acct-vendors";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setEditing(null);
        load();
        setMsg(editing ? "Updated" : "Added vendor");
      } else {
        const json = await res.json();
        setMsg(`Error: ${json.error}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendor(id: string) {
    if (!confirm("Delete this vendor? This won't affect existing product cost records.")) return;
    await fetch(`/api/admin/full-accounting/acct-vendors/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Accounting Vendors</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Vendors used to source jade products — real names are admin-only.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <button onClick={startAdd}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit Vendor" : "New Vendor"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              ["vendor_code", "Vendor Code *", "e.g. VN_JADE_01"],
              ["vendor_display_name", "Display Name", "Public-safe name"],
              ["real_name", "Real Name", "Actual person/company name"],
              ["country", "Country", "e.g. Vietnam"],
              ["contact_info", "Contact Info", "Phone, WeChat, etc."],
              ["notes", "Notes", ""],
            ] as [keyof typeof EMPTY_FORM, string, string][]).map(([field, label, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                <input
                  type="text"
                  value={form[field]}
                  placeholder={placeholder}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.vendor_code.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
              {saving ? "Saving…" : editing ? "Update" : "Add"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : vendors.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No vendors yet — add one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="pl-4 pr-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Display Name</th>
                <th className="px-3 py-3 text-left">Real Name</th>
                <th className="px-3 py-3 text-left">Country</th>
                <th className="px-3 py-3 text-left">Contact</th>
                <th className="px-3 py-3 text-left">Notes</th>
                <th className="pr-4 pl-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="pl-4 pr-3 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">{v.vendor_code}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{v.vendor_display_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{v.real_name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500">{v.country ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{v.contact_info ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs max-w-[160px] truncate">{v.notes ?? "—"}</td>
                  <td className="pr-4 pl-3 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(v)}
                        className="text-xs px-2.5 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                        Edit
                      </button>
                      <button onClick={() => deleteVendor(v.id)}
                        className="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
