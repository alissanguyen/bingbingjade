"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CAMPAIGN_PRESETS } from "@/lib/campaign-email-presets";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { SubscriberPicker } from "../SubscriberPicker";

export type { PickerSubscriber } from "../SubscriberPicker";

export interface CampaignProduct {
  id: string;
  name: string;
  category: string;
  slug: string;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  imageUrl: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelet",
  bangle: "Bangle",
  ring: "Ring",
  pendant: "Pendant",
  necklace: "Necklace",
  set: "Set",
  earring: "Earrings",
  raw_material: "Raw Material",
};

// Tailwind color classes for preset cards in the admin UI
const PRESET_COLORS: Record<string, { card: string; dot: string; active: string }> = {
  gray:    { card: "hover:border-gray-400",    dot: "bg-gray-500",    active: "border-gray-500 bg-gray-50 dark:bg-gray-800/40" },
  blue:    { card: "hover:border-blue-400",    dot: "bg-blue-500",    active: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
  rose:    { card: "hover:border-rose-400",    dot: "bg-rose-500",    active: "border-rose-500 bg-rose-50 dark:bg-rose-900/20" },
  violet:  { card: "hover:border-violet-400",  dot: "bg-violet-500",  active: "border-violet-500 bg-violet-50 dark:bg-violet-900/20" },
  pink:    { card: "hover:border-pink-400",    dot: "bg-pink-500",    active: "border-pink-500 bg-pink-50 dark:bg-pink-900/20" },
  amber:   { card: "hover:border-amber-400",   dot: "bg-amber-500",   active: "border-amber-500 bg-amber-50 dark:bg-amber-900/20" },
  red:     { card: "hover:border-red-400",     dot: "bg-red-500",     active: "border-red-500 bg-red-50 dark:bg-red-900/20" },
  emerald: { card: "hover:border-emerald-400", dot: "bg-emerald-500", active: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" },
  teal:    { card: "hover:border-teal-400",    dot: "bg-teal-500",    active: "border-teal-500 bg-teal-50 dark:bg-teal-900/20" },
  indigo:  { card: "hover:border-indigo-400",  dot: "bg-indigo-500",  active: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" },
  orange:  { card: "hover:border-orange-400",  dot: "bg-orange-500",  active: "border-orange-500 bg-orange-50 dark:bg-orange-900/20" },
};

function getColor(c: string) {
  return PRESET_COLORS[c] ?? PRESET_COLORS.emerald;
}

interface FormState {
  subject: string;
  headline: string;
  intro: string;
  urgencyLine: string;
  ctaText: string;
  ctaLink: string;
  discountCode: string;
  expiryDate: string;
}

const EMPTY_FORM: FormState = {
  subject: "",
  headline: "",
  intro: "",
  urgencyLine: "",
  ctaText: "Shop the Collection",
  ctaLink: "/products",
  discountCode: "",
  expiryDate: "",
};

export function CampaignClient({
  products,
  subscribers,
  subscriberCount,
}: {
  products: CampaignProduct[];
  subscribers: import("../SubscriberPicker").PickerSubscriber[];
  subscriberCount: number;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Products
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Recipients
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // UI state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectPreset(id: string) {
    const preset = CAMPAIGN_PRESETS[id as keyof typeof CAMPAIGN_PRESETS];
    if (!preset) return;
    setSelectedPreset(id);
    setForm({
      subject:     preset.subject,
      headline:    preset.headline,
      intro:       preset.intro,
      urgencyLine: preset.urgency ?? "",
      ctaText:     preset.cta,
      ctaLink:     preset.ctaLink,
      discountCode: "",
      expiryDate:  "",
    });
    setError(null);
  }

  function setField(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function validate() {
    if (!form.subject.trim())  { setError("Subject is required."); return false; }
    if (!form.headline.trim()) { setError("Headline is required."); return false; }
    if (!form.intro.trim())    { setError("Intro is required."); return false; }
    if (!form.ctaText.trim())  { setError("CTA text is required."); return false; }
    if (!form.ctaLink.trim())  { setError("CTA link is required."); return false; }
    if (targetMode === "selected" && selectedEmails.size === 0) {
      setError("Select at least one subscriber.");
      return false;
    }
    setError(null);
    return true;
  }

  function buildBody(includeTargetEmails = true) {
    return {
      subject:      form.subject.trim(),
      headline:     form.headline.trim(),
      intro:        form.intro.trim(),
      urgencyLine:  form.urgencyLine.trim() || undefined,
      ctaText:      form.ctaText.trim(),
      ctaLink:      form.ctaLink.trim(),
      discountCode: form.discountCode.trim() || undefined,
      expiryDate:   form.expiryDate.trim() || undefined,
      productIds:   selectedProducts.size > 0 ? [...selectedProducts] : undefined,
      targetEmails: includeTargetEmails && targetMode === "selected" ? [...selectedEmails] : null,
    };
  }

  async function handlePreview() {
    if (!validate()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/emails/campaign?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false)),
      });
      const data = await res.json();
      if (res.ok) setPreviewHtml(data.html);
      else setError(data.error ?? "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (!validate()) return;
    const recipientLabel =
      targetMode === "all"
        ? `${subscriberCount} subscriber${subscriberCount !== 1 ? "s" : ""}`
        : `${selectedEmails.size} selected subscriber${selectedEmails.size !== 1 ? "s" : ""}`;
    if (!confirm(`Send "${form.subject}" to ${recipientLabel}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/emails/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error ?? "Send failed.");
    } catch {
      setError("Network error.");
    } finally {
      setSending(false);
    }
  }

  const displayPrice = (p: CampaignProduct) => p.sale_price_usd ?? p.price_display_usd;

  const Field = ({
    label,
    hint,
    optional,
    children,
  }: {
    label: string;
    hint?: string;
    optional?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {optional && <span className="ml-1 text-gray-400 font-normal">(optional)</span>}
      </label>
      {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5 leading-snug">{hint}</p>}
      {children}
    </div>
  );

  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      {/* Back */}
      <Link
        href="/custom-emails-admin"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Custom Emails
      </Link>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">New Campaign</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Launch seasonal promotions and special campaigns with a luxury touch.
      </p>

      <div className="space-y-6">

        {/* ── STEP 1: Campaign Type ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">1</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Campaign Type</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(CAMPAIGN_PRESETS) as [keyof typeof CAMPAIGN_PRESETS, typeof CAMPAIGN_PRESETS[keyof typeof CAMPAIGN_PRESETS]][]).map(([key, preset]) => {
              const c = getColor(preset.color);
              const isActive = selectedPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectPreset(key)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? `${c.active} dark:border-opacity-60`
                      : `border-gray-200 dark:border-gray-700 ${c.card} hover:bg-gray-50 dark:hover:bg-gray-800`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                    <span className="font-semibold text-gray-900 dark:text-white">{preset.emoji} {preset.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-3.5 leading-snug line-clamp-1">
                    {preset.subject}
                  </p>
                </button>
              );
            })}
          </div>
          {!selectedPreset && (
            <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 italic">
              Select a campaign type to populate default content — all fields are editable.
            </p>
          )}
        </section>

        {/* ── STEP 2: Email Content ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">2</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Email Content</h2>
          </div>
          <div className="space-y-4">
            <Field label="Subject Line" hint="Appears in the inbox before opening.">
              <input type="text" value={form.subject} onChange={(e) => setField("subject", e.target.value)}
                placeholder="e.g. Early Access: Black Friday Begins Now" className={inputCls} />
            </Field>

            <Field label="Headline" hint="Large bold text at the top of the email body.">
              <input type="text" value={form.headline} onChange={(e) => setField("headline", e.target.value)}
                placeholder="e.g. Black Friday, Refined." className={inputCls} />
            </Field>

            <Field label="Intro Paragraph" hint="2–4 sentences. Sets the tone. Luxury, intentional.">
              <textarea rows={4} value={form.intro} onChange={(e) => setField("intro", e.target.value)}
                placeholder="Write your campaign message…" className={`${inputCls} resize-none`} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Urgency Line" optional hint="Shown in small caps below intro. e.g. 'Ends Sunday · Limited pieces'">
                <input type="text" value={form.urgencyLine} onChange={(e) => setField("urgencyLine", e.target.value)}
                  placeholder="Ends Sunday · Limited pieces available" className={inputCls} />
              </Field>
              <Field label="Expiry Date" optional hint="Shown below discount code if provided.">
                <input type="text" value={form.expiryDate} onChange={(e) => setField("expiryDate", e.target.value)}
                  placeholder="e.g. May 12, 2026" className={inputCls} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="CTA Button Text">
                <input type="text" value={form.ctaText} onChange={(e) => setField("ctaText", e.target.value)}
                  placeholder="Shop the Selection" className={inputCls} />
              </Field>
              <Field label="CTA Link" hint="Path or full URL.">
                <input type="text" value={form.ctaLink} onChange={(e) => setField("ctaLink", e.target.value)}
                  placeholder="/products or https://…" className={inputCls} />
              </Field>
            </div>

            <Field label="Discount Code" optional hint="Displayed in a highlighted box in the email.">
              <input type="text" value={form.discountCode} onChange={(e) => setField("discountCode", e.target.value.toUpperCase())}
                placeholder="e.g. JADE20" className={`${inputCls} font-mono uppercase tracking-widest`} />
            </Field>
          </div>
        </section>

        {/* ── STEP 3: Products (optional) ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">3</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Featured Products</h2>
              <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
            </div>
            <span className="text-xs text-gray-400">
              {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : "None — campaign only"}
            </span>
          </div>
          {selectedProducts.size > 0 && (
            <button type="button" onClick={() => setSelectedProducts(new Set())}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors mb-3">
              Clear selection
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => {
              const isSelected = selectedProducts.has(p.id);
              const price = displayPrice(p);
              return (
                <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                  className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                    isSelected
                      ? "border-emerald-500 ring-1 ring-emerald-500/30"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}>
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.name} fill unoptimized className="object-cover" sizes="160px" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>
                    }
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSelected ? "bg-emerald-500 text-white" : "bg-white/80 border border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-0.5">{p.name}</p>
                    {price != null && (
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">${price.toFixed(2)}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── STEP 4: Recipients ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">4</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Recipients</h2>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} className="accent-emerald-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                All subscribers <span className="text-gray-400">({subscriberCount.toLocaleString()})</span>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" checked={targetMode === "selected"} onChange={() => setTargetMode("selected")} className="accent-emerald-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Select specific subscribers</span>
            </label>
            {targetMode === "selected" && (
              <div className="mt-2">
                <SubscriberPicker subscribers={subscribers} selected={selectedEmails} onChange={setSelectedEmails} />
              </div>
            )}
          </div>
        </section>

        {/* Error / Result */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.
            {result.failed > 0 ? ` ${result.failed} failed.` : ""}
          </div>
        )}

        {/* ── STEP 5: Preview + Send ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handlePreview} disabled={previewing}
            className="flex-1 rounded-full border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors disabled:opacity-50">
            {previewing ? "Generating preview…" : "Preview Email"}
          </button>
          <button type="button" onClick={handleSend} disabled={sending}
            className="flex-1 rounded-full bg-emerald-700 hover:bg-emerald-800 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {sending
              ? "Sending…"
              : `Send${targetMode === "all" ? ` to ${subscriberCount.toLocaleString()} subscribers` : ` to ${selectedEmails.size} selected`}`
            }
          </button>
        </div>
      </div>

      {previewHtml && (
        <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} maxWidth="max-w-2xl" />
      )}
    </div>
  );
}
