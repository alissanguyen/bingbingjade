"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  computeStrictnessScore,
  classifyRequest,
  getDepositCents,
} from "@/lib/sourcing-classification";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "bracelet" | "bangle" | "ring" | "pendant" | "necklace" | "set" | "other";
type Timeline = "asap" | "1-3_months" | "3-6_months" | "flexible";
type TranslucencyPref = "very_transparent" | "semi_transparent" | "opaque" | "";

interface RefImage {
  type: "storage";
  path: string;          // storage path for the API
  url: string;           // public URL for display (unoptimized)
  originalName: string;
  ext: string;
  previewObjectUrl?: string; // blob URL for instant preview before upload completes
  uploading?: boolean;
  error?: string;
}

interface FormState {
  name: string;
  email: string;
  category: Category | "";
  budget_min: string;
  budget_max: string;
  preferred_color: string;
  size_description: string;
  must_haves: string;
  must_avoid: string;
  timeline: Timeline;
  notes: string;
  // Conditional flags
  close_reference_match: boolean;
  reference_notes: string;
  exact_color_matters: boolean;
  color_detail: string;
  pattern_veining_matters: boolean;
  pattern_description: string;
  translucency_matters: boolean;
  translucency_preference: TranslucencyPref;
  exact_dimensions_matters: boolean;
  exact_dimensions: string;
  // Reference images (uploaded files)
  ref_images: RefImage[];
  // Honeypot (hidden from real users)
  website: string;
}

const INITIAL: FormState = {
  name: "", email: "", category: "", budget_min: "", budget_max: "",
  preferred_color: "", size_description: "", must_haves: "", must_avoid: "",
  timeline: "flexible", notes: "",
  close_reference_match: false, reference_notes: "",
  exact_color_matters: false, color_detail: "",
  pattern_veining_matters: false, pattern_description: "",
  translucency_matters: false, translucency_preference: "",
  exact_dimensions_matters: false, exact_dimensions: "",
  ref_images: [],
  website: "",
};

const ACCEPTED_TYPES = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf";
const MAX_FILES = 10;
const MAX_SIZE_MB = 15;

function isImageExt(ext: string) {
  return ["jpg", "jpeg", "png", "webp"].includes(ext.toLowerCase());
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bracelet", label: "Bracelet" },
  { value: "bangle", label: "Bangle" },
  { value: "ring", label: "Ring" },
  { value: "pendant", label: "Pendant" },
  { value: "necklace", label: "Necklace" },
  { value: "set", label: "Set" },
  { value: "other", label: "Other" },
];

const TIMELINES: { value: Timeline; label: string }[] = [
  { value: "asap", label: "As soon as possible" },
  { value: "1-3_months", label: "Within 1–3 months" },
  { value: "3-6_months", label: "3–6 months is fine" },
  { value: "flexible", label: "Flexible — no rush" },
];

// ── Style helpers ─────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

const labelClass =
  "block text-xs text-[16px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1.5";

const sectionClass =
  "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 space-y-5";

function Toggle({
  label, checked, onChange, description,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        checked
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div>
        <p className={`text-sm font-medium ${checked ? "text-emerald-800 dark:text-emerald-200" : "text-gray-700 dark:text-gray-300"}`}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-[16px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-gray-600"
      }`}>
        {checked && (
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SourcingForm() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function removeRefImage(idx: number) {
    const img = form.ref_images[idx];
    if (img?.previewObjectUrl) URL.revokeObjectURL(img.previewObjectUrl);
    set("ref_images", form.ref_images.filter((_, i) => i !== idx));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = ""; // reset so same file can be re-selected

    const remaining = MAX_FILES - form.ref_images.filter((r) => !r.error).length;
    const toProcess = files.slice(0, remaining);

    // Add placeholders immediately with preview object URLs
    const placeholders: RefImage[] = toProcess.map((f) => ({
      type: "storage",
      path: "",
      url: "",
      originalName: f.name,
      ext: f.name.split(".").pop()?.toLowerCase() ?? "",
      previewObjectUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      uploading: true,
    }));

    const startIdx = form.ref_images.length;
    set("ref_images", [...form.ref_images, ...placeholders]);

    // Upload each file
    for (let i = 0; i < toProcess.length; i++) {
      const file = toProcess[i];
      const idx = startIdx + i;

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setForm((prev) => {
          const next = [...prev.ref_images];
          next[idx] = { ...next[idx], uploading: false, error: `File too large (max ${MAX_SIZE_MB} MB)` };
          return { ...prev, ref_images: next };
        });
        continue;
      }

      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch("/api/sourcing/upload-ref", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setForm((prev) => {
            const next = [...prev.ref_images];
            next[idx] = { ...next[idx], uploading: false, error: data.error ?? "Upload failed" };
            return { ...prev, ref_images: next };
          });
        } else {
          setForm((prev) => {
            const next = [...prev.ref_images];
            next[idx] = {
              type: "storage",
              path: data.path,
              url: data.url,
              originalName: data.originalName,
              ext: data.ext,
              previewObjectUrl: next[idx].previewObjectUrl,
              uploading: false,
            };
            return { ...prev, ref_images: next };
          });
        }
      } catch {
        setForm((prev) => {
          const next = [...prev.ref_images];
          next[idx] = { ...next[idx], uploading: false, error: "Upload failed. Please try again." };
          return { ...prev, ref_images: next };
        });
      }
    }
  }

  // Client-side classification preview (server always recomputes)
  const score = computeStrictnessScore({
    closeReferenceMatch: form.close_reference_match,
    exactColorMatters: form.exact_color_matters,
    patternVeiningMatters: form.pattern_veining_matters,
    translucencyMatters: form.translucency_matters,
    exactDimensionsMatters: form.exact_dimensions_matters,
    mustHaves: form.must_haves,
  });
  const requestType = classifyRequest(score);
  const depositCents = getDepositCents(requestType);
  const depositDollars = depositCents / 100;

  const uploadingCount = form.ref_images.filter((r) => r.uploading).length;

  const formFilled =
    form.name.trim().length >= 2 &&
    form.email.includes("@") &&
    form.category !== "" &&
    form.budget_min !== "" &&
    !isNaN(Number(form.budget_min)) &&
    uploadingCount === 0;

  // Show preview once the base fields are filled
  useEffect(() => {
    if (formFilled) setShowPreview(true);
  }, [formFilled]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formFilled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sourcing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          category: form.category,
          budget_min: Number(form.budget_min),
          budget_max: form.budget_max !== "" ? Number(form.budget_max) : null,
          preferred_color: form.preferred_color.trim() || null,
          size_description: form.size_description.trim() || null,
          must_haves: form.must_haves.trim() || null,
          must_avoid: form.must_avoid.trim() || null,
          timeline: form.timeline,
          notes: form.notes.trim() || null,
          close_reference_match: form.close_reference_match,
          reference_notes: form.reference_notes.trim() || null,
          exact_color_matters: form.exact_color_matters,
          color_detail: form.color_detail.trim() || null,
          pattern_veining_matters: form.pattern_veining_matters,
          pattern_description: form.pattern_description.trim() || null,
          translucency_matters: form.translucency_matters,
          translucency_preference: form.translucency_preference || null,
          exact_dimensions_matters: form.exact_dimensions_matters,
          exact_dimensions: form.exact_dimensions.trim() || null,
          reference_images: form.ref_images
            .filter((r) => !r.uploading && !r.error && r.path)
            .map(({ type, path, url, originalName, ext }) => ({ type, path, url, originalName, ext })),
          // Honeypot fields (real users leave these empty)
          website: form.website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0d0d0d]">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
          <p className="text-xs text-[16px] font-semibold uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 mb-3">
            Custom Sourcing
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            Your Perfect Piece,<br />Sourced for You
          </h1>
          <p className="mt-4 text-base text-gray-500 dark:text-gray-400 leading-relaxed max-w-xl">
            Tell us exactly what you&apos;re looking for — color, size, translucency, budget — and we&apos;ll hand-source a jadeite piece matched to your preferences.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Deposit applied as store credit
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              No obligation if nothing fits
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Certified natural jadeite only
            </div>
          </div>
        </div>
      </div>

      {/* ── How classification works ───────────────────────────── */}
      <div className="mx-auto max-w-3xl px-6 pt-10">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
            How your request is classified
          </p>
          <p className="text-xs text-[16px] text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
            Based on your preferences, requests are automatically classified as <strong>Standard ($50 deposit)</strong> or <strong>Premium ($100 deposit)</strong>. More specific requests — close photo matching, exact dimensions, or strict must-haves — are classified as Premium. The deposit is fully applied as credit toward your purchase.
          </p>
        </div>
      </div>

      {cancelled && (
        <div className="mx-auto max-w-3xl px-6 pt-4">
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Your payment was cancelled. Your request details are preserved below — you can continue when ready.
          </div>
        </div>
      )}

      {/* ── Form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-6 py-10 space-y-8">

        {/* Honeypot — hidden from real users */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, pointerEvents: "none" }}
        />

        {/* ── Section 1: Who are you ───────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">About you</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Your Name *</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Full name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div>
              <label className={labelClass}>Email Address *</label>
              <input
                type="email"
                className={inputClass}
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: What you're looking for ──────────────── */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">What you&apos;re looking for</h2>

          <div>
            <label className={labelClass}>Piece Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("category", value)}
                  className={`rounded-lg border px-3 py-2.5 text-xs text-[16px] font-medium transition-colors text-center ${
                    form.category === value
                      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Minimum Budget (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  className={`${inputClass} pl-7`}
                  placeholder="e.g. 500"
                  min={50}
                  value={form.budget_min}
                  onChange={(e) => set("budget_min", e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Maximum Budget (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  className={`${inputClass} pl-7`}
                  placeholder="No limit"
                  min={Number(form.budget_min) || 50}
                  value={form.budget_max}
                  onChange={(e) => set("budget_max", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Preferred Color / Tone</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Rich imperial green, light lavender, icy white…"
              value={form.preferred_color}
              onChange={(e) => set("preferred_color", e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label className={labelClass}>Size or Dimensions (optional)</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Ring size 7, pendant ~30mm, bracelet 56mm inner diameter"
              value={form.size_description}
              onChange={(e) => set("size_description", e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        {/* ── Section 3: Must-haves & Must-avoids ─────────────── */}
        <div className={sectionClass}>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Requirements</h2>
          <p className="text-xs text-[16px] text-[16px] text-gray-400 dark:text-gray-500 -mt-2">
            Listing 3+ specific must-haves may upgrade your request to <strong>Premium</strong>.
          </p>

          <div>
            <label className={labelClass}>Must-haves</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="e.g. natural color, no cracks, strong translucency, uniform texture…"
              value={form.must_haves}
              onChange={(e) => set("must_haves", e.target.value)}
              maxLength={2000}
            />
          </div>

          <div>
            <label className={labelClass}>Must-avoids (optional)</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="e.g. no brown spots, avoid overly dark color, no visible inclusions…"
              value={form.must_avoid}
              onChange={(e) => set("must_avoid", e.target.value)}
              maxLength={2000}
            />
          </div>
        </div>

        {/* ── Section 4: Specificity ───────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Specificity</h2>
              <p className="text-xs text-[16px] text-[16px] text-gray-400 dark:text-gray-500 mt-0.5">
                These signals determine whether your request is Standard or Premium.
              </p>
            </div>
            {showPreview && (
              <div className={`shrink-0 px-3 py-1.5 rounded-full text-xs text-[16px] text-[16px] font-bold tracking-wide ${
                requestType === "premium"
                  ? "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                  : "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
              }`}>
                {requestType === "premium" ? "Premium" : "Standard"} · Score {score}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Toggle
              label="I have a close reference photo or piece I want to match"
              description="You'll upload or link reference images. Adds +2 to strictness score."
              checked={form.close_reference_match}
              onChange={(v) => set("close_reference_match", v)}
            />
            {form.close_reference_match && (
              <div className="ml-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <label className={labelClass}>Reference notes (optional)</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={2}
                  placeholder="Describe what you love about the reference piece…"
                  value={form.reference_notes}
                  onChange={(e) => set("reference_notes", e.target.value)}
                  maxLength={1000}
                />
              </div>
            )}

            <Toggle
              label="Exact color / tone is important"
              description="You have a specific shade in mind and won't accept significant variation."
              checked={form.exact_color_matters}
              onChange={(v) => set("exact_color_matters", v)}
            />
            {form.exact_color_matters && (
              <div className="ml-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Describe the exact color you want…"
                  value={form.color_detail}
                  onChange={(e) => set("color_detail", e.target.value)}
                  maxLength={500}
                />
              </div>
            )}

            <Toggle
              label="Pattern / veining is important"
              description="The natural markings and texture of the jade matter to you."
              checked={form.pattern_veining_matters}
              onChange={(v) => set("pattern_veining_matters", v)}
            />
            {form.pattern_veining_matters && (
              <div className="ml-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. clean and even, visible fiber pattern, no visible veins…"
                  value={form.pattern_description}
                  onChange={(e) => set("pattern_description", e.target.value)}
                  maxLength={500}
                />
              </div>
            )}

            <Toggle
              label="Translucency level is important"
              description="How much light passes through the stone matters to you."
              checked={form.translucency_matters}
              onChange={(v) => set("translucency_matters", v)}
            />
            {form.translucency_matters && (
              <div className="ml-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <div className="flex gap-2 flex-wrap">
                  {(["very_transparent", "semi_transparent", "opaque"] as TranslucencyPref[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => set("translucency_preference", opt)}
                      className={`px-3 py-1.5 rounded-full text-xs text-[16px] font-medium border transition-colors ${
                        form.translucency_preference === opt
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {opt === "very_transparent" ? "Very transparent (glass-like)" :
                       opt === "semi_transparent" ? "Semi-transparent" : "Opaque"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Toggle
              label="Exact size / shape / dimensions are important"
              description="You need a specific size that won't fit otherwise (e.g. ring size, wrist fit, pendant dimensions)."
              checked={form.exact_dimensions_matters}
              onChange={(v) => set("exact_dimensions_matters", v)}
            />
            {form.exact_dimensions_matters && (
              <div className="ml-4 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Ring size 6.5 US, bracelet inner diameter 54–56mm…"
                  value={form.exact_dimensions}
                  onChange={(e) => set("exact_dimensions", e.target.value)}
                  maxLength={500}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Section 5: Reference images ──────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reference Images (optional)</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            Upload photos or PDFs of pieces you like. Accepted: JPG, PNG, WebP, HEIC, PDF · Max {MAX_SIZE_MB} MB each · Up to {MAX_FILES} files.
          </p>

          {/* Drop zone / file input */}
          {form.ref_images.filter((r) => !r.error).length < MAX_FILES && (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer px-6 py-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {uploadingCount > 0 ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}…` : "Click to upload files"}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">JPG · PNG · WebP · HEIC · PDF</span>
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="sr-only"
                onChange={handleFileSelect}
              />
            </label>
          )}

          {/* File grid */}
          {form.ref_images.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {form.ref_images.map((img, idx) => (
                <li key={idx} className={`relative rounded-xl border overflow-hidden bg-gray-50 dark:bg-gray-900 ${img.error ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"}`}>
                  {/* Preview area */}
                  <div className="relative w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {(img.previewObjectUrl && isImageExt(img.ext)) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img.previewObjectUrl} alt={img.originalName} className="w-full h-full object-cover" />
                    ) : (img.url && isImageExt(img.ext)) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img.url} alt={img.originalName} className="w-full h-full object-cover" />
                    ) : img.ext === "pdf" ? (
                      <div className="flex flex-col items-center gap-1 p-3 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="text-[10px] text-gray-400 font-mono uppercase">PDF</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-3 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span className="text-[10px] text-gray-400 font-mono uppercase">{img.ext || "file"}</span>
                      </div>
                    )}

                    {/* Uploading spinner overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-gray-950/70">
                        <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Filename + remove */}
                  <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                    <span className="text-[10px] leading-tight truncate">
                      {img.error
                        ? <span className="text-red-500 dark:text-red-400">{img.error}</span>
                        : <span className="text-gray-400 dark:text-gray-500">{img.originalName}</span>
                      }
                    </span>
                    {!img.uploading && (
                      <button
                        type="button"
                        onClick={() => removeRefImage(idx)}
                        className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Section 6: Timeline & notes ──────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Timeline & additional notes</h2>

          <div>
            <label className={labelClass}>Timeline</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {TIMELINES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("timeline", value)}
                  className={`rounded-lg border px-4 py-2.5 text-sm text-left transition-colors ${
                    form.timeline === value
                      ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Additional notes (optional)</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Anything else we should know? A gift occasion, personal meaning, budget flexibility…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={3000}
            />
          </div>
        </div>

        {/* ── Preview + Deposit ─────────────────────────────────── */}
        {showPreview && (
          <div className={`rounded-2xl border-2 p-6 space-y-4 ${
            requestType === "premium"
              ? "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20"
              : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[16px] font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1">
                  Request Summary
                </p>
                <h3 className={`text-lg font-bold ${
                  requestType === "premium"
                    ? "text-violet-800 dark:text-violet-200"
                    : "text-emerald-800 dark:text-emerald-200"
                }`}>
                  {requestType === "premium" ? "Premium Sourcing Request" : "Standard Sourcing Request"}
                </h3>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs text-[16px] font-bold tracking-wider shrink-0 ${
                requestType === "premium"
                  ? "bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
                  : "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
              }`}>
                {requestType.toUpperCase()}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {form.category && (
                <div>
                  <span className="text-xs text-[16px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Category</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200 capitalize">{form.category}</p>
                </div>
              )}
              {form.budget_min && (
                <div>
                  <span className="text-xs text-[16px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Budget</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    ${form.budget_min}{form.budget_max ? `–$${form.budget_max}` : "+"}
                  </p>
                </div>
              )}
              {form.preferred_color && (
                <div>
                  <span className="text-xs text-[16px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Color</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{form.preferred_color}</p>
                </div>
              )}
              {form.timeline !== "flexible" && (
                <div>
                  <span className="text-xs text-[16px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Timeline</span>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {TIMELINES.find((t) => t.value === form.timeline)?.label}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Deposit due today</p>
                  <p className={`text-2xl font-bold ${
                    requestType === "premium"
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}>
                    ${depositDollars}
                  </p>
                  <p className="text-xs text-[16px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Applied as credit toward your final purchase
                  </p>
                </div>
                <div className="text-right text-xs text-[16px] text-gray-400 dark:text-gray-500 space-y-0.5">
                  <p>Strictness score: {score}</p>
                  <p>Classification: {requestType}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────── */}
        <div className="flex flex-col items-stretch gap-3">
          <button
            type="submit"
            disabled={!formFilled || loading}
            className={`w-full py-4 rounded-xl text-sm font-semibold tracking-wide transition-all ${
              formFilled && !loading
                ? requestType === "premium"
                  ? "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/30"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"
                : "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Redirecting to payment…
              </span>
            ) : uploadingCount > 0 ? (
              `Uploading ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}… please wait`
            ) : formFilled ? (
              `Pay $${depositDollars} Deposit — ${requestType === "premium" ? "Premium" : "Standard"}`
            ) : (
              "Fill in your details to continue"
            )}
          </button>
          <p className="text-center text-xs text-[16px] text-gray-400 dark:text-gray-500">
            Secured by Stripe. Deposit is credited to your first order — no obligation if nothing fits.
          </p>
          <p className="text-center text-xs text-[16px] text-gray-400 dark:text-gray-500">
            Questions?{" "}
            <Link href="/contact" className="text-emerald-600 dark:text-emerald-400 hover:underline">
              Contact us first
            </Link>
            .
          </p>
        </div>
      </form>
    </div>
  );
}
