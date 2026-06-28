"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewLivestreamForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle]           = useState("");
  const [platform, setPlatform]     = useState("instagram");
  const [scheduledAt, setScheduledAt] = useState("");
  const [codePrefix, setCodePrefix] = useState("A");
  const [itemCount, setItemCount]   = useState(10);
  const [notes, setNotes]           = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/livestreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          platform,
          scheduled_at: scheduledAt || null,
          code_prefix: codePrefix.trim() || "A",
          item_count: itemCount,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed"); return; }
      router.push(`/livestreams-admin/${json.livestream.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <a href="/livestreams-admin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">← Livestreams</a>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">New Livestream</h1>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Title <span className="text-red-400">*</span></label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Saturday Jade Live — June 28" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Platform</label>
                <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Scheduled At</label>
                <input type="datetime-local" className={inputCls} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Item Code Prefix</label>
                <input className={inputCls} value={codePrefix} onChange={(e) => setCodePrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} maxLength={3} placeholder="A" />
                <p className="text-xs text-gray-400 mt-1">Items will be A1, A2, … or B1, B2, …</p>
              </div>
              <div>
                <label className={labelCls}>Number of Items</label>
                <input type="number" className={inputCls} value={itemCount} onChange={(e) => setItemCount(parseInt(e.target.value) || 10)} min={1} max={200} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes (internal)</label>
              <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prep notes, source details, etc." />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {saving ? "Creating…" : "Create Livestream"}
              </button>
              <a
                href="/livestreams-admin"
                className="px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
