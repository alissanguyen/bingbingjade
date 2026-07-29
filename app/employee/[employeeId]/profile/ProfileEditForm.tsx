"use client";

import { useState } from "react";
import { updateOwnEmployeeProfile } from "@/app/employee/actions";

export function ProfileEditForm({ initialBio, initialAvatarUrl }: { initialBio: string; initialAvatarUrl: string }) {
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("bio", bio);
      fd.append("avatarUrl", avatarUrl);
      await updateOwnEmployeeProfile(fd);
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bio</label>
        <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Profile Photo URL</label>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className={inputCls} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-xs text-gray-500 dark:text-gray-400">{msg}</span>}
      </div>
    </div>
  );
}
