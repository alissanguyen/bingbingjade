"use client";

import { useState } from "react";
import { createVendor, updateVendor, deleteVendors } from "./actions";
import type { Vendor, VendorPlatform } from "@/types/vendor";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: { value: VendorPlatform; label: string; dot: string; badge: string }[] = [
  { value: "zalo",     label: "Zalo",     dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  { value: "facebook", label: "Facebook", dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" },
  { value: "wechat",   label: "WeChat",   dot: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  { value: "tiktok",   label: "TikTok",   dot: "bg-gray-800",   badge: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  { value: "other",    label: "Other",    dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
];

const EMPTY_FORM = { name: "", platform: "zalo" as VendorPlatform, contact: "", notes: "" };

const INPUT = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors";

// ── Platform picker ───────────────────────────────────────────────────────────

function PlatformPicker({
  value,
  onChange,
}: {
  value: VendorPlatform;
  onChange: (v: VendorPlatform) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
            value === p.value
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
              : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Vendor form fields (shared by add + edit) ─────────────────────────────────

function VendorFields({
  form,
  onChange,
}: {
  form: typeof EMPTY_FORM;
  onChange: (f: typeof EMPTY_FORM) => void;
}) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Name <span className="text-red-400">*</span>
        </label>
        <input required value={form.name} onChange={set("name")} placeholder="e.g. Minh Jade Supplier" className={INPUT} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Platform</label>
        <PlatformPicker value={form.platform} onChange={(v) => onChange({ ...form, platform: v })} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Contact</label>
        <input value={form.contact} onChange={set("contact")} placeholder="Phone, username, or link" className={INPUT} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes</label>
        <textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Trustworthiness, specialties, pricing notes…" className={INPUT} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VendorsClient({ vendors: initialVendors }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [query, setQuery] = useState("");

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Bulk delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(query.toLowerCase()) ||
    (v.contact ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.add(v.id));
        return next;
      });
    }
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const fd = new FormData();
    fd.set("name", addForm.name);
    fd.set("platform", addForm.platform);
    fd.set("contact", addForm.contact);
    fd.set("notes", addForm.notes);
    const res = await createVendor(fd);
    setAdding(false);
    if (res.error) { setAddError(res.error); return; }
    const newVendor: Vendor = {
      id: res.id!,
      name: addForm.name.trim(),
      platform: addForm.platform,
      contact: addForm.contact || null,
      notes: addForm.notes || null,
    };
    setVendors((prev) => [newVendor, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    setAddForm(EMPTY_FORM);
    setShowAdd(false);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setEditForm({ name: v.name, platform: v.platform, contact: v.contact ?? "", notes: v.notes ?? "" });
    setEditError(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setEditError(null);
    const fd = new FormData();
    fd.set("name", editForm.name);
    fd.set("platform", editForm.platform);
    fd.set("contact", editForm.contact);
    fd.set("notes", editForm.notes);
    const res = await updateVendor(id, fd);
    setSaving(false);
    if (res.error) { setEditError(res.error); return; }
    setVendors((prev) =>
      prev.map((v) => v.id === id
        ? { ...v, name: editForm.name.trim(), platform: editForm.platform, contact: editForm.contact || null, notes: editForm.notes || null }
        : v
      )
    );
    setEditingId(null);
  }

  // ── Bulk delete ───────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} vendor${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteVendors(ids);
    setDeleting(false);
    if (res.error) { setDeleteError(res.error); return; }
    setVendors((prev) => prev.filter((v) => !ids.includes(v.id)));
    setSelected(new Set());
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vendors</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{vendors.length} total</p>
          </div>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddError(null); setAddForm(EMPTY_FORM); }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Vendor
          </button>
        </div>

        {/* Add form — slide down */}
        {showAdd && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">New Vendor</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <VendorFields form={addForm} onChange={setAddForm} />
              {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-semibold transition-colors">
                  {adding ? "Adding…" : "Add Vendor"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + bulk action bar */}
        <div className="flex gap-3 mb-4 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…"
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              {deleting ? "Deleting…" : `Delete ${selected.size}`}
            </button>
          )}
        </div>

        {deleteError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              {query ? "No vendors match your search." : "No vendors yet."}
            </p>
          ) : (
            <>
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600"
                />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} vendor${filtered.length !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((v) => {
                  const platform = PLATFORMS.find((p) => p.value === v.platform) ?? PLATFORMS[4];
                  const isEditing = editingId === v.id;
                  const isChecked = selected.has(v.id);

                  return (
                    <div key={v.id} className={`transition-colors ${isChecked ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                      {isEditing ? (
                        // ── Inline edit ──────────────────────────────────────
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editing</span>
                            <button type="button" onClick={() => setEditingId(null)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                          <VendorFields form={editForm} onChange={setEditForm} />
                          {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setEditingId(null)}
                              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              Cancel
                            </button>
                            <button type="button" onClick={() => handleSave(v.id)} disabled={saving || !editForm.name.trim()}
                              className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white py-2.5 text-sm font-semibold transition-colors">
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // ── Row view ─────────────────────────────────────────
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(v.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-600 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${platform.badge}`}>
                                {platform.label}
                              </span>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{v.name}</p>
                            </div>
                            {v.contact && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{v.contact}</p>
                            )}
                            {v.notes && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{v.notes}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
