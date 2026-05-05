"use client";

import { useEffect, useState } from "react";
import { BANNER_PRESETS, getPreset, resolveStyle } from "@/lib/banner-config";
import type { BannerConfig, BannerStyle } from "@/lib/banner-config";
import { DateTimePicker } from "./DateTimePicker";

const DEFAULT_CONFIG: BannerConfig = {
  is_active: false,
  preset: "new_drops",
  messages: [],
  start_date: null,
  end_date: null,
  cta_text: null,
  cta_link: null,
  style: null,
};

export function BannerManager() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showStyle, setShowStyle] = useState(false);

  useEffect(() => {
    fetch("/api/admin/banner")
      .then((r) => r.json())
      .then((data) => {
        setConfig({
          is_active:  Boolean(data.is_active),
          preset:     data.preset ?? "custom",
          messages:   Array.isArray(data.messages) ? data.messages : [],
          start_date: data.start_date ?? null,
          end_date:   data.end_date   ?? null,
          cta_text:   data.cta_text   ?? null,
          cta_link:   data.cta_link   ?? null,
          style:      data.style      ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // When a preset is selected, populate its defaults (but don't overwrite if user has customised)
  function selectPreset(presetId: string) {
    const preset = getPreset(presetId);
    setConfig((c) => ({
      ...c,
      preset: presetId,
      messages: preset.defaultMessages,
      cta_text: preset.defaultCtaText ?? null,
      cta_link: preset.defaultCtaLink ?? null,
      style: preset.defaultStyle,
    }));
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, is_active: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setConfig((c) => ({ ...c, is_active: true }));
      setMsg({ ok: true, text: "Banner saved and activated." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function removeBanner() {
    if (!confirm("Remove the active banner? It will stop showing immediately.")) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, is_active: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed");
      setConfig((c) => ({ ...c, is_active: false }));
      setMsg({ ok: true, text: "Banner removed." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function setStyle(partial: Partial<BannerStyle>) {
    setConfig((c) => ({ ...c, style: { ...resolveStyle(c.style), ...partial } }));
  }

  function addMessage() {
    setConfig((c) => ({ ...c, messages: [...c.messages, ""] }));
  }

  function updateMessage(i: number, value: string) {
    setConfig((c) => {
      const next = [...c.messages];
      next[i] = value;
      return { ...c, messages: next };
    });
  }

  function removeMessage(i: number) {
    setConfig((c) => ({ ...c, messages: c.messages.filter((_, idx) => idx !== i) }));
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-6 py-5 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const activeMessages = config.messages.filter((m) => m.trim() !== "");
  const resolvedStyle = resolveStyle(config.style);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Announcement Banner</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {config.is_active
              ? `Active · ${activeMessages.length} message${activeMessages.length !== 1 ? "s" : ""} rotating`
              : "Inactive — configure below and click Save to activate"}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
          config.is_active
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
          {config.is_active ? "Live" : "Off"}
        </span>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* 1. Preset picker */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Campaign Preset
          </label>
          <div className="flex flex-wrap gap-2">
            {BANNER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  config.preset === p.id
                    ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <span>{p.emoji}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Messages */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Messages <span className="normal-case font-normal">(rotate right-to-left)</span>
          </label>
          <div className="space-y-2">
            {config.messages.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 dark:text-gray-600 w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  type="text"
                  value={m}
                  onChange={(e) => updateMessage(i, e.target.value)}
                  placeholder={`Message ${i + 1}`}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => removeMessage(i)}
                  className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={addMessage}
              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add message
            </button>
          </div>
        </div>

        {/* 3. CTA */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
            Call to Action <span className="normal-case font-normal">(optional — hidden during countdown)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.cta_text ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, cta_text: e.target.value || null }))}
              placeholder="Button label"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
            />
            <input
              type="text"
              value={config.cta_link ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, cta_link: e.target.value || null }))}
              placeholder="/products or https://…"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* 4. Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Countdown to <span className="normal-case font-normal">(optional)</span>
              </label>
              {config.start_date && (
                <button type="button" onClick={() => setConfig((c) => ({ ...c, start_date: null }))}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Clear</button>
              )}
            </div>
            {config.start_date ? (
              <DateTimePicker value={config.start_date} onChange={(iso) => setConfig((c) => ({ ...c, start_date: iso }))} />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">No countdown</span>
                <button type="button"
                  onClick={() => { const d = new Date(); d.setHours(12, 0, 0, 0); setConfig((c) => ({ ...c, start_date: d.toISOString() })); }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">+ Add</button>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                Auto-hide after <span className="normal-case font-normal">(optional)</span>
              </label>
              {config.end_date && (
                <button type="button" onClick={() => setConfig((c) => ({ ...c, end_date: null }))}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Clear</button>
              )}
            </div>
            {config.end_date ? (
              <DateTimePicker value={config.end_date} onChange={(iso) => setConfig((c) => ({ ...c, end_date: iso }))} />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">Run until removed</span>
                <button type="button"
                  onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); setConfig((c) => ({ ...c, end_date: d.toISOString() })); }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline">+ Add</button>
              </div>
            )}
          </div>
        </div>

        {/* 5. Style */}
        <div>
          <button type="button" onClick={() => setShowStyle((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showStyle ? "rotate-90" : ""}`}><polyline points="9 18 15 12 9 6"/></svg>
            Colors &amp; Style
          </button>
          {showStyle && (
            <div className="mt-3 space-y-3">
              {/* Theme toggle */}
              <div className="flex gap-2">
                {(["dark", "light", "auto"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setStyle({ theme: t })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors ${
                      (config.style?.theme ?? "dark") === t
                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                    }`}>{t}</button>
                ))}
              </div>
              {/* Color inputs */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "backgroundColor", label: "Background" },
                  { key: "textColor",       label: "Text" },
                  { key: "accentColor",     label: "Accent (CTA / digits)" },
                  { key: "borderColor",     label: "Border" },
                ] as { key: keyof BannerStyle & string; label: string }[]).map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-gray-400 dark:text-gray-500 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(config.style?.[key] as string | undefined) ?? resolvedStyle[key as keyof typeof resolvedStyle] as string}
                        onChange={(e) => setStyle({ [key]: e.target.value } as Partial<BannerStyle>)}
                        className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5 bg-white dark:bg-gray-800"
                      />
                      <input
                        type="text"
                        value={(config.style?.[key] as string | undefined) ?? resolvedStyle[key as keyof typeof resolvedStyle] as string}
                        onChange={(e) => setStyle({ [key]: e.target.value } as Partial<BannerStyle>)}
                        className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button"
                onClick={() => setConfig((c) => ({ ...c, style: getPreset(c.preset).defaultStyle }))}
                className="text-[10px] text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                ↺ Reset to preset defaults
              </button>
            </div>
          )}
        </div>

        {/* Preview */}
        {activeMessages.length > 0 && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
              Preview
            </label>
            <div
              className="rounded-lg px-4 py-2.5 text-xs sm:text-[13px] text-center font-medium tracking-wide relative overflow-hidden"
              style={{
                backgroundColor: resolvedStyle.backgroundColor,
                color: resolvedStyle.textColor,
                border: `1px solid ${resolvedStyle.borderColor}`,
              }}
            >
              {activeMessages[0]}
              {config.cta_text && (
                <span className="ml-3 text-[10px] font-semibold uppercase tracking-wider border-b pb-px"
                  style={{ color: resolvedStyle.accentColor, borderColor: `${resolvedStyle.accentColor}60` }}>
                  {config.cta_text} →
                </span>
              )}
              {activeMessages.length > 1 && (
                <span className="ml-2 opacity-50 text-[10px]">+ {activeMessages.length - 1} more</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button type="button" onClick={save} disabled={saving || activeMessages.length === 0}
            className="px-5 py-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-sm font-medium text-white disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save & Activate"}
          </button>
          {config.is_active && (
            <button type="button" onClick={removeBanner} disabled={saving}
              className="px-5 py-2 rounded-full border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
              Remove Banner
            </button>
          )}
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
