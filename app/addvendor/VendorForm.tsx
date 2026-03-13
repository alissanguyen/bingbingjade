"use client";

import { useState } from "react";
import { createVendor } from "./actions";
import type { VendorPlatform } from "@/types/vendor";

const PLATFORMS: { value: VendorPlatform; label: string; color: string }[] = [
  { value: "zalo",     label: "Zalo",     color: "bg-blue-500" },
  { value: "facebook", label: "Facebook", color: "bg-indigo-500" },
  { value: "wechat",   label: "WeChat",   color: "bg-green-500" },
  { value: "tiktok",   label: "TikTok",   color: "bg-gray-900 dark:bg-gray-100" },
  { value: "other",    label: "Other",    color: "bg-gray-400" },
];

export function VendorForm() {
  const [platform, setPlatform] = useState<VendorPlatform>("zalo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; id?: string } | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", notes: "" });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("platform", platform);
    fd.append("contact", form.contact);
    fd.append("notes", form.notes);

    const res = await createVendor(fd);
    setResult(res);
    if (res.success) {
      setForm({ name: "", contact: "", notes: "" });
      setPlatform("zalo");
    }
    setIsSubmitting(false);
  };

  const inputClass = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Identity */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Vendor Info</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Vendor Name <span className="text-red-400">*</span></label>
            <input
              required
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Minh Jade Supplier"
              className={inputClass}
            />
          </div>

          {/* Platform picker */}
          <div>
            <label className={labelClass}>Platform <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                    platform === p.value
                      ? "border-transparent text-white " + p.color
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${platform === p.value ? "bg-white/70" : p.color}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Contact</label>
            <input
              value={form.contact}
              onChange={set("contact")}
              placeholder="Phone number, username, or profile link"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">Optional — how to reach them on {PLATFORMS.find(p => p.value === platform)?.label}</p>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Notes</h2>
        <div>
          <label className={labelClass}>Internal Notes</label>
          <textarea
            rows={4}
            value={form.notes}
            onChange={set("notes")}
            placeholder="Trustworthiness, specialties, pricing notes, payment preferences..."
            className={inputClass}
          />
        </div>
      </section>

      {/* Result */}
      {result?.success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Vendor added successfully.</p>
          {result.id && (
            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500 font-mono">ID: {result.id}</p>
          )}
        </div>
      )}
      {result?.error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {result.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "Saving…" : "Add Vendor"}
      </button>
    </form>
  );
}
