"use client";

import { useState } from "react";
import { updateVendor } from "./actions";
import type { Vendor, VendorPlatform } from "@/types/vendor";

const PLATFORMS: { value: VendorPlatform; label: string; badge: string }[] = [
  { value: "zalo",     label: "Zalo",     badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  { value: "facebook", label: "Facebook", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" },
  { value: "wechat",   label: "WeChat",   badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  { value: "tiktok",   label: "TikTok",   badge: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  { value: "other",    label: "Other",    badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
];

export function VendorList({ vendors: initialVendors }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", platform: "zalo" as VendorPlatform, contact: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(query.toLowerCase())
  );

  const startEdit = (v: Vendor) => {
    setEditingId(v.id);
    setEditForm({ name: v.name, platform: v.platform, contact: v.contact ?? "", notes: v.notes ?? "" });
    setError(null);
    setSavedId(null);
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("name", editForm.name.trim());
    fd.append("platform", editForm.platform);
    fd.append("contact", editForm.contact);
    fd.append("notes", editForm.notes);
    const res = await updateVendor(id, fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, name: editForm.name.trim(), platform: editForm.platform, contact: editForm.contact || null, notes: editForm.notes || null }
          : v
      )
    );
    setSavedId(id);
    setEditingId(null);
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search vendors…"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors mb-6"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-12">No vendors found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const platform = PLATFORMS.find((p) => p.value === v.platform) ?? PLATFORMS[4];
            const isEditing = editingId === v.id;

            return (
              <div
                key={v.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all"
              >
                {isEditing ? (
                  <div className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Editing vendor</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Platform</label>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setEditForm((f) => ({ ...f, platform: p.value }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              editForm.platform === p.value
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contact</label>
                      <input
                        value={editForm.contact}
                        onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                        placeholder="Phone, username, or link"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
                      <textarea
                        rows={3}
                        value={editForm.notes}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Trustworthiness, specialties, pricing notes…"
                        className={inputClass}
                      />
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 rounded-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(v.id)}
                        disabled={saving || !editForm.name.trim()}
                        className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-sm font-medium text-white disabled:opacity-50 transition-colors"
                      >
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between px-5 py-4 gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${platform.badge}`}>
                        {platform.label}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{v.name}</p>
                          {savedId === v.id && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>
                          )}
                        </div>
                        {v.contact && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{v.contact}</p>
                        )}
                        {v.notes && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{v.notes}</p>
                        )}
                        <p className="text-[11px] text-gray-300 dark:text-gray-600 font-mono mt-1">{v.id}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
