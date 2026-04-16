"use client";

import { useEffect, useState } from "react";
import { BANNER_TEMPLATES } from "@/app/components/AnnouncementBanner";

interface BannerConfig {
  is_active: boolean;
  template: string;
  target_date: string | null;
  background: "black" | "white";
}

const DEFAULT: BannerConfig = {
  is_active: false,
  template: "restock",
  target_date: null,
  background: "black",
};

// Convert UTC ISO string to local datetime-local input value
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert local datetime-local value back to ISO string
function fromLocalInputValue(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

export function BannerManager() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/banner")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          is_active:   Boolean(data.is_active),
          template:    data.template ?? "restock",
          target_date: data.target_date ?? null,
          background:  data.background === "white" ? "white" : "black",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedTpl = BANNER_TEMPLATES.find((t) => t.value === config.template);
  const hasDate = selectedTpl?.hasDate ?? false;

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMsg({ ok: true, text: "Banner saved." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  // Preview text
  const previewText = selectedTpl
    ? hasDate
      ? `${selectedTpl.text}${config.target_date ? ` on ${new Date(config.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "…"} · 02h · 30m · 00s`
      : selectedTpl.text
    : "";

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-5 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Drop Announcement Banner</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Shown at the top of the site with optional countdown.</p>
        </div>
        {/* Active toggle */}
        <button
          type="button"
          onClick={() => setConfig((c) => ({ ...c, is_active: !c.is_active }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            config.is_active
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
              : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
          {config.is_active ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Message template */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Message Template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BANNER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.value}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, template: tpl.value, target_date: tpl.hasDate ? c.target_date : null }))}
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  config.template === tpl.value
                    ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <span className="font-medium">{tpl.label}</span>
                <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tpl.text}{tpl.hasDate ? " on [date]" : ""}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Target date (only for templates that use it) */}
        {hasDate && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1.5">
              Drop Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={toLocalInputValue(config.target_date)}
              onChange={(e) => setConfig((c) => ({ ...c, target_date: fromLocalInputValue(e.target.value) }))}
              className="w-full sm:w-72 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {config.target_date && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {new Date(config.target_date).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
              </p>
            )}
          </div>
        )}

        {/* Background */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Background
          </label>
          <div className="flex gap-2">
            {(["black", "white"] as const).map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, background: bg }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  config.background === bg
                    ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <span className={`w-3 h-3 rounded-full border ${bg === "black" ? "bg-gray-950 border-gray-700" : "bg-white border-gray-300"}`} />
                {bg === "black" ? "Dark" : "Light"}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Preview
          </label>
          <div className={`rounded-lg px-4 py-2.5 text-xs sm:text-sm text-center font-medium relative overflow-hidden ${
            config.background === "black"
              ? "bg-gray-950 text-white"
              : "bg-white text-gray-900 border border-gray-200"
          }`}>
            {previewText || <span className="opacity-40">Select a template to preview</span>}
            {hasDate && (
              <span className={`ml-2 font-mono font-semibold ${config.background === "black" ? "text-emerald-400" : "text-emerald-600"}`}>
                ← live countdown
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Banner"}
          </button>
          {msg && (
            <span className={`text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
