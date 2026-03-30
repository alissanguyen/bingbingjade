"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBar } from "@/app/components/AdminBar";

type ApprovedUser = {
  id: string;
  email: string;
  full_name: string;
  access_level: "standard" | "senior";
  is_active: boolean;
  created_at: string;
};

const ACCESS_LABELS: Record<string, string> = {
  standard: "Standard — product & inventory management, own orders only",
  senior: "Senior — same as Standard (reserved for expanded permissions)",
};

export default function ApprovedUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Add user form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", password: "", accessLevel: "standard" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", password: "", accessLevel: "standard", isActive: true });
  const [editError, setEditError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/approved-users");
    if (res.status === 401) { setAuthError(true); setLoading(false); return; }
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (authError) {
    router.push("/admin-login");
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    const res = await fetch("/api/admin/approved-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setFormLoading(false);
    if (!res.ok) { setFormError(data.error); return; }
    setShowAdd(false);
    setForm({ email: "", fullName: "", password: "", accessLevel: "standard" });
    load();
  }

  function startEdit(user: ApprovedUser) {
    setEditing(user.id);
    setEditForm({ fullName: user.full_name, password: "", accessLevel: user.access_level, isActive: user.is_active });
    setEditError("");
  }

  async function handleUpdate(id: string) {
    setEditError("");
    const payload: Record<string, unknown> = { id, fullName: editForm.fullName, accessLevel: editForm.accessLevel, isActive: editForm.isActive };
    if (editForm.password) payload.password = editForm.password;
    const res = await fetch("/api/admin/approved-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setEditError(data.error); return; }
    setEditing(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/approved-users?id=${id}`, { method: "DELETE" });
    load();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <>
      <AdminBar />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Approved Users</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Partner portal accounts — can manage products and inventory, cannot see profit margin data or other users&apos; orders.
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setFormError(""); }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            + Add User
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-8 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New Approved User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                  <input required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password (min 8 chars)</label>
                  <input required type="password" minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Access Level</label>
                  <select value={form.accessLevel} onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value }))} className={inputCls}>
                    <option value="standard">Standard</option>
                    <option value="senior">Senior</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{ACCESS_LABELS[form.accessLevel]}</p>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={formLoading} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors">
                  {formLoading ? "Creating…" : "Create User"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User list */}
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400">No approved users yet.</p>
        ) : (
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                {editing === user.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                        <input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New Password (leave blank to keep)</label>
                        <input type="password" minLength={8} value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Access Level</label>
                        <select value={editForm.accessLevel} onChange={e => setEditForm(f => ({ ...f, accessLevel: e.target.value }))} className={inputCls}>
                          <option value="standard">Standard</option>
                          <option value="senior">Senior</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-0.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                        </label>
                      </div>
                    </div>
                    {editError && <p className="text-xs text-red-500">{editError}</p>}
                    <div className="flex gap-3">
                      <button onClick={() => handleUpdate(user.id)} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors">Save</button>
                      <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">
                          {user.access_level}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Added {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(user)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(user.id, user.full_name)} className="rounded-lg border border-red-200 dark:border-red-900 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
