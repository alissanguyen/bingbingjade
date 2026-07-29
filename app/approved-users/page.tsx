"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBar } from "@/app/components/AdminBar";

type EmployeeProfile = {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  start_date: string;
  default_rate_per_approved_listing: number;
  status: "active" | "suspended" | "terminated";
  can_view_vendors: boolean;
};

type ApprovedUser = {
  id: string;
  email: string;
  full_name: string;
  access_level: "standard" | "senior";
  role: "partner" | "catalog_contributor";
  is_active: boolean;
  created_at: string;
  employee_profiles: EmployeeProfile[] | EmployeeProfile | null;
};

function employeeProfileOf(u: ApprovedUser): EmployeeProfile | null {
  if (!u.employee_profiles) return null;
  return Array.isArray(u.employee_profiles) ? (u.employee_profiles[0] ?? null) : u.employee_profiles;
}

const ACCESS_LABELS: Record<string, string> = {
  standard: "Standard — product & inventory management, own orders only",
  senior: "Senior — same as Standard (reserved for expanded permissions)",
};

export default function ApprovedUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    email: "", fullName: "", password: "", accessLevel: "standard", role: "partner",
    ratePerApprovedListing: "5.00", bio: "", startDate: "", canViewVendors: false,
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "", password: "", accessLevel: "standard", isActive: true,
    bio: "", avatarUrl: "", ratePerApprovedListing: "", employeeStatus: "active" as "active" | "suspended" | "terminated",
    canViewVendors: false,
  });
  const [editError, setEditError] = useState("");
  const [reassignTarget, setReassignTarget] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/admin/approved-users");
    if (res.status === 401) { setAuthError(true); setLoading(false); return; }
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets state on mount; pre-existing pattern
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
      body: JSON.stringify({
        ...form,
        ratePerApprovedListing: Number(form.ratePerApprovedListing) || 0,
      }),
    });
    const data = await res.json();
    setFormLoading(false);
    if (!res.ok) { setFormError(data.error); return; }
    setShowAdd(false);
    setForm({ email: "", fullName: "", password: "", accessLevel: "standard", role: "partner", ratePerApprovedListing: "5.00", bio: "", startDate: "", canViewVendors: false });
    load();
  }

  function startEdit(user: ApprovedUser) {
    const profile = employeeProfileOf(user);
    setEditing(user.id);
    setEditForm({
      fullName: user.full_name,
      password: "",
      accessLevel: user.access_level,
      isActive: user.is_active,
      bio: profile?.bio ?? "",
      avatarUrl: profile?.avatar_url ?? "",
      ratePerApprovedListing: profile ? String(profile.default_rate_per_approved_listing) : "",
      employeeStatus: profile?.status ?? "active",
      canViewVendors: profile?.can_view_vendors ?? false,
    });
    setEditError("");
  }

  async function handleUpdate(id: string) {
    setEditError("");
    const user = users.find((u) => u.id === id);
    const isEmployee = user?.role === "catalog_contributor";
    const payload: Record<string, unknown> = {
      id, fullName: editForm.fullName, accessLevel: editForm.accessLevel, isActive: editForm.isActive,
    };
    if (editForm.password) payload.password = editForm.password;
    if (isEmployee) {
      payload.bio = editForm.bio;
      payload.avatarUrl = editForm.avatarUrl;
      payload.ratePerApprovedListing = Number(editForm.ratePerApprovedListing) || 0;
      payload.employeeStatus = editForm.employeeStatus;
      payload.canViewVendors = editForm.canViewVendors;
    }
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

  async function handleRevokeSessions(id: string) {
    if (!confirm("Revoke all active sessions for this account? They'll be signed out everywhere immediately.")) return;
    await fetch("/api/admin/approved-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, revokeSessions: true }),
    });
    load();
  }

  async function handleReassign(fromId: string) {
    const toId = reassignTarget[fromId];
    if (!toId) return;
    const res = await fetch(`/api/admin/employees/${fromId}/reassign-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toEmployeeId: toId }),
    });
    const data = await res.json();
    alert(res.ok ? `Reassigned ${data.reassignedCount} unfinished listing(s).` : data.error);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/approved-users?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to delete.");
    }
    load();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500";

  const catalogContributors = users.filter((u) => u.role === "catalog_contributor");

  return (
    <>
      <AdminBar />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Approved Users &amp; Employees</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Partner accounts manage products/inventory. Catalog Contributor accounts can only create listings and submit them for approval.
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setFormError(""); }}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors self-start sm:self-auto shrink-0"
          >
            + Add User
          </button>
        </div>

        {showAdd && (
          <div className="mb-8 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New Account</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                  <input required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password (min 8 chars)</label>
                  <input required type="password" minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inputCls}>
                    <option value="partner">Partner</option>
                    <option value="catalog_contributor">Catalog Contributor</option>
                  </select>
                </div>
              </div>
              {form.role === "partner" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Access Level</label>
                  <select value={form.accessLevel} onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value }))} className={inputCls}>
                    <option value="standard">Standard</option>
                    <option value="senior">Senior</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{ACCESS_LABELS[form.accessLevel]}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pay Rate per Approved Listing ($)</label>
                    <input type="number" step="0.01" min="0" value={form.ratePerApprovedListing} onChange={e => setForm(f => ({ ...f, ratePerApprovedListing: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bio (optional)</label>
                    <textarea rows={2} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.canViewVendors} onChange={e => setForm(f => ({ ...f, canViewVendors: e.target.checked }))} className="rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Can view vendor list when creating listings</span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Off by default — most Catalog Contributors should not see vendor contact info.</p>
                  </div>
                </div>
              )}
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={formLoading} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors">
                  {formLoading ? "Creating…" : "Create Account"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400">No accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {users.map(user => {
              const profile = employeeProfileOf(user);
              const isEmployee = user.role === "catalog_contributor";
              return (
                <div key={user.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                  {editing === user.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                          <input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New Password (leave blank to keep)</label>
                          <input type="password" minLength={8} value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className={inputCls} />
                        </div>
                      </div>
                      {!isEmployee && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      )}
                      {isEmployee && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pay Rate per Approved Listing ($)</label>
                            <input type="number" step="0.01" min="0" value={editForm.ratePerApprovedListing} onChange={e => setEditForm(f => ({ ...f, ratePerApprovedListing: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Account Status</label>
                            <select value={editForm.employeeStatus} onChange={e => setEditForm(f => ({ ...f, employeeStatus: e.target.value as typeof editForm.employeeStatus }))} className={inputCls}>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                              <option value="terminated">Terminated</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bio</label>
                            <textarea rows={2} value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} className={inputCls} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={editForm.canViewVendors} onChange={e => setEditForm(f => ({ ...f, canViewVendors: e.target.checked }))} className="rounded" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Can view vendor list when creating listings</span>
                            </label>
                          </div>
                        </div>
                      )}
                      {editError && <p className="text-xs text-red-500">{editError}</p>}
                      <div className="flex gap-3">
                        <button onClick={() => handleUpdate(user.id)} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors">Save</button>
                        <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                          <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 capitalize">
                            {isEmployee ? "Catalog Contributor" : user.access_level}
                          </span>
                          {profile?.status && profile.status !== "active" && (
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 capitalize">
                              {profile.status}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</p>
                        {isEmployee && profile && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            ${Number(profile.default_rate_per_approved_listing).toFixed(2)}/listing · started {new Date(profile.start_date).toLocaleDateString()}
                            {profile.can_view_vendors && " · can view vendors"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isEmployee && (
                          <a href={`/employee/${user.id}`} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline">
                            View Dashboard
                          </a>
                        )}
                        <button onClick={() => startEdit(user)} className="rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleRevokeSessions(user.id)} className="rounded-lg border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 px-3 py-1.5 text-xs font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                          Revoke Sessions
                        </button>
                        <button onClick={() => handleDelete(user.id, user.full_name)} className="rounded-lg border border-red-200 dark:border-red-900 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {isEmployee && !user.is_active && catalogContributors.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Reassign unfinished listings to:</label>
                      <select
                        value={reassignTarget[user.id] ?? ""}
                        onChange={e => setReassignTarget(t => ({ ...t, [user.id]: e.target.value }))}
                        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select employee…</option>
                        {catalogContributors.filter(c => c.id !== user.id).map(c => (
                          <option key={c.id} value={c.id}>{c.full_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleReassign(user.id)}
                        disabled={!reassignTarget[user.id]}
                        className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        Reassign
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
