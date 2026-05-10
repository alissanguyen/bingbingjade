"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { CAMPAIGN_PRESETS } from "@/lib/campaign-email-presets";
import { getTemplatesForCategory } from "@/lib/campaign-email-templates";
import { EmailPreviewModal } from "../EmailPreviewModal";
import { SubscriberPicker } from "../SubscriberPicker";

export type { PickerSubscriber } from "../SubscriberPicker";

export interface CampaignEventSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  coupon_code: string | null;
  discount_type: "fixed" | "percent" | null;
  discount_value: number | null;
  allow_coupon_stack: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

// Product from the general catalog (used in the manual picker)
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

// Product sourced from a linked campaign event (includes event pricing)
export interface CampaignEmailProduct {
  id: string;
  name: string;
  category: string;
  slug: string;
  show_price: boolean;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  event_price_usd: number | null;
  status: string;
  imageUrl: string | null;
  is_featured_for_email: boolean;
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

const PRESET_COLORS: Record<string, { card: string; dot: string; active: string; suggested: string }> = {
  gray:    { card: "hover:border-gray-400",    dot: "bg-gray-500",    active: "border-gray-500 bg-gray-50 dark:bg-gray-800/40",          suggested: "border-gray-300 bg-gray-50/60 dark:bg-gray-800/20" },
  blue:    { card: "hover:border-blue-400",    dot: "bg-blue-500",    active: "border-blue-500 bg-blue-50 dark:bg-blue-900/20",           suggested: "border-blue-200 bg-blue-50/40 dark:bg-blue-900/10" },
  rose:    { card: "hover:border-rose-400",    dot: "bg-rose-500",    active: "border-rose-500 bg-rose-50 dark:bg-rose-900/20",           suggested: "border-rose-200 bg-rose-50/40 dark:bg-rose-900/10" },
  violet:  { card: "hover:border-violet-400",  dot: "bg-violet-500",  active: "border-violet-500 bg-violet-50 dark:bg-violet-900/20",     suggested: "border-violet-200 bg-violet-50/40 dark:bg-violet-900/10" },
  pink:    { card: "hover:border-pink-400",    dot: "bg-pink-500",    active: "border-pink-500 bg-pink-50 dark:bg-pink-900/20",           suggested: "border-pink-200 bg-pink-50/40 dark:bg-pink-900/10" },
  amber:   { card: "hover:border-amber-400",   dot: "bg-amber-500",   active: "border-amber-500 bg-amber-50 dark:bg-amber-900/20",        suggested: "border-amber-200 bg-amber-50/40 dark:bg-amber-900/10" },
  red:     { card: "hover:border-red-400",     dot: "bg-red-500",     active: "border-red-500 bg-red-50 dark:bg-red-900/20",             suggested: "border-red-200 bg-red-50/40 dark:bg-red-900/10" },
  emerald: { card: "hover:border-emerald-400", dot: "bg-emerald-500", active: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20", suggested: "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10" },
  teal:    { card: "hover:border-teal-400",    dot: "bg-teal-500",    active: "border-teal-500 bg-teal-50 dark:bg-teal-900/20",           suggested: "border-teal-200 bg-teal-50/40 dark:bg-teal-900/10" },
  indigo:  { card: "hover:border-indigo-400",  dot: "bg-indigo-500",  active: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",    suggested: "border-indigo-200 bg-indigo-50/40 dark:bg-indigo-900/10" },
  orange:  { card: "hover:border-orange-400",  dot: "bg-orange-500",  active: "border-orange-500 bg-orange-50 dark:bg-orange-900/20",    suggested: "border-orange-200 bg-orange-50/40 dark:bg-orange-900/10" },
};

function getColor(c: string) {
  return PRESET_COLORS[c] ?? PRESET_COLORS.emerald;
}

/** Human-readable date range from ISO strings. */
function computeDateRange(startsAt: string | null, endsAt: string | null): string | null {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (endsAt) return `Until ${fmt(endsAt)}`;
  if (startsAt) return `Starting ${fmt(startsAt)}`;
  return null;
}

/** Short urgency label from dates, used as a suggested urgency line. */
function computeUrgencyLine(startsAt: string | null, endsAt: string | null): string | null {
  if (endsAt) {
    const end = new Date(endsAt);
    const label = end.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `Ends ${label} · Limited pieces`;
  }
  return null;
}

interface FormState {
  subject: string;
  headline: string;
  intro: string;
  urgencyLine: string;
  ctaText: string;
  ctaLink: string;
  discountType: "none" | "fixed" | "percentage";
  discountValue: string;
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
  discountType: "none",
  discountValue: "",
  discountCode: "",
  expiryDate: "",
};

export function CampaignClient({
  products,
  subscribers,
  subscriberCount,
  campaignEvents = [],
}: {
  products: CampaignProduct[];
  subscribers: import("../SubscriberPicker").PickerSubscriber[];
  subscriberCount: number;
  campaignEvents?: CampaignEventSummary[];
}) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [linkedCampaignId, setLinkedCampaignId] = useState<string>("");
  const [bannerImage, setBannerImage] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Campaign-sourced products (loaded when a campaign event is linked)
  const [campaignProducts, setCampaignProducts] = useState<CampaignEmailProduct[]>([]);
  const [loadingCampaignProducts, setLoadingCampaignProducts] = useState(false);
  const [eventPricingApplied, setEventPricingApplied] = useState(false);
  const [allowCouponStack, setAllowCouponStack] = useState(true);

  // Products: use campaign products when available, else general catalog
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Recipients
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // UI state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; couponCreated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Suggested template preset keys for the currently linked campaign's category
  const suggestedPresetKeys = useMemo<Set<string>>(() => {
    if (!linkedCampaignId) return new Set();
    const ce = campaignEvents.find((c) => c.id === linkedCampaignId);
    if (!ce) return new Set();
    return new Set(getTemplatesForCategory(ce.category).map((t) => t.presetKey));
  }, [linkedCampaignId, campaignEvents]);

  async function linkCampaignEvent(campaignId: string) {
    setLinkedCampaignId(campaignId);
    setCampaignProducts([]);
    setEventPricingApplied(false);
    setAllowCouponStack(true);

    if (!campaignId) {
      setSelectedProducts(new Set());
      return;
    }

    const ce = campaignEvents.find((c) => c.id === campaignId);
    if (!ce) return;

    const urgency = computeUrgencyLine(ce.starts_at, ce.ends_at);

    // Auto-fill form fields from campaign
    setForm((f) => ({
      ...f,
      ctaLink: `/sale/${ce.slug}`,
      ctaText: f.ctaText === "Shop the Collection" || f.ctaText === "" ? "Shop the Event" : f.ctaText,
      discountCode: ce.coupon_code ?? f.discountCode,
      discountType: ce.coupon_code && ce.discount_type
        ? (ce.discount_type === "percent" ? "percentage" : "fixed")
        : f.discountType,
      discountValue: ce.coupon_code && ce.discount_value != null
        ? String(ce.discount_value)
        : f.discountValue,
      urgencyLine: urgency ?? f.urgencyLine,
    }));

    setAllowCouponStack(ce.allow_coupon_stack);

    // Auto-select the matching template preset (if exactly one for this category)
    const templates = getTemplatesForCategory(ce.category);
    if (templates.length === 1) {
      const preset = CAMPAIGN_PRESETS[templates[0].presetKey as keyof typeof CAMPAIGN_PRESETS];
      if (preset) {
        setSelectedPreset(templates[0].presetKey);
        setBannerImage(preset.bannerImage ?? "");
        // Merge preset content but keep campaign-specific overrides
        setForm((f) => ({
          subject:      preset.subject,
          headline:     preset.headline,
          intro:        preset.intro,
          urgencyLine:  urgency ?? preset.urgency ?? f.urgencyLine,
          ctaText:      "Shop the Event",
          ctaLink:      `/sale/${ce.slug}`,
          discountType: ce.coupon_code && ce.discount_type
            ? (ce.discount_type === "percent" ? "percentage" : "fixed")
            : "none",
          discountValue: ce.coupon_code && ce.discount_value != null
            ? String(ce.discount_value)
            : "",
          discountCode:  ce.coupon_code ?? "",
          expiryDate:    ce.ends_at
            ? new Date(ce.ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "",
        }));
      }
    }

    // Fetch featured campaign products with event pricing
    setLoadingCampaignProducts(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/email-products`);
      if (res.ok) {
        const data = await res.json() as { products: CampaignEmailProduct[] };
        const prods = data.products ?? [];
        setCampaignProducts(prods);
        setSelectedProducts(new Set(prods.map((p) => p.id)));

        const hasEventPricing = prods.some(
          (p) => p.event_price_usd != null && p.price_display_usd != null && p.event_price_usd < p.price_display_usd
        );
        setEventPricingApplied(hasEventPricing);

        // If event pricing is applied and stacking is off, clear the discount amount
        // so the email shows the "event savings" notice instead of an amount badge.
        if (hasEventPricing && !ce.allow_coupon_stack) {
          setForm((f) => ({ ...f, discountType: "none", discountValue: "" }));
        }
      }
    } catch {
      // Non-fatal: user can still manually select products
    } finally {
      setLoadingCampaignProducts(false);
    }
  }

  function selectPreset(id: string) {
    const preset = CAMPAIGN_PRESETS[id as keyof typeof CAMPAIGN_PRESETS];
    if (!preset) return;
    setSelectedPreset(id);
    setBannerImage(preset.bannerImage ?? "");
    // Only fill content fields; keep campaign-specific overrides if campaign is linked
    setForm((f) => ({
      subject:      preset.subject,
      headline:     preset.headline,
      intro:        preset.intro,
      urgencyLine:  f.urgencyLine || (preset.urgency ?? ""),
      ctaText:      linkedCampaignId ? f.ctaText : preset.cta,
      ctaLink:      linkedCampaignId ? f.ctaLink : preset.ctaLink,
      discountType:  f.discountType,
      discountValue: f.discountValue,
      discountCode:  f.discountCode,
      expiryDate:    f.expiryDate,
    }));
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
    const hasDiscount =
      form.discountType !== "none" &&
      form.discountValue.trim() !== "" &&
      parseFloat(form.discountValue) > 0;

    const ce = linkedCampaignId ? campaignEvents.find((c) => c.id === linkedCampaignId) : null;
    const expiryDate = form.expiryDate.trim() || undefined;

    return {
      subject:       form.subject.trim(),
      headline:      form.headline.trim(),
      intro:         form.intro.trim(),
      urgencyLine:   form.urgencyLine.trim() || undefined,
      ctaText:       form.ctaText.trim(),
      ctaLink:       form.ctaLink.trim(),
      discountType:  hasDiscount ? (form.discountType as "fixed" | "percentage") : undefined,
      discountValue: hasDiscount ? parseFloat(form.discountValue) : undefined,
      // Send the code independently of discountType so it can appear in event-pricing notices
      discountCode:  form.discountCode.trim() || undefined,
      expiryDate,
      eventPricingApplied: eventPricingApplied || undefined,
      allowCouponStack:    eventPricingApplied ? allowCouponStack : undefined,
      // Always send selected productIds so the exact user selection is honoured.
      // Also pass campaignEventId when a campaign is linked so the server can
      // resolve event pricing for those specific products.
      ...(selectedProducts.size > 0 ? { productIds: [...selectedProducts] } : {}),
      ...(linkedCampaignId ? { campaignEventId: linkedCampaignId } : {}),
      targetEmails:  includeTargetEmails && targetMode === "selected" ? [...selectedEmails] : null,
      bannerImage:   bannerImage || undefined,
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

  const inputCls =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400";

  const Field = ({
    label, hint, optional, children,
  }: {
    label: string; hint?: string; optional?: boolean; children: React.ReactNode;
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

  // Product grid: use campaign products when available, else general catalog
  const showCampaignProducts = campaignProducts.length > 0;
  const linkedCe = linkedCampaignId ? campaignEvents.find((c) => c.id === linkedCampaignId) : null;

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

        {/* ── Campaign Event Link ── */}
        {campaignEvents.length > 0 && (
          <section className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🗓️</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400">Link Campaign Event</h2>
              <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-snug">
              Select an existing campaign event to auto-fill content, CTA link, coupon code, and featured products with event pricing.
            </p>
            <select
              value={linkedCampaignId}
              onChange={(e) => linkCampaignEvent(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">— No campaign event linked —</option>
              {campaignEvents.map((ce) => {
                const dateRange = computeDateRange(ce.starts_at, ce.ends_at);
                return (
                  <option key={ce.id} value={ce.id}>
                    {ce.name}
                    {" · "}
                    {ce.status === "draft" ? "Draft" : ce.status === "active" ? "Active" : ce.status}
                    {dateRange ? ` · ${dateRange}` : ""}
                  </option>
                );
              })}
            </select>

            {linkedCe && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] text-violet-600 dark:text-violet-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>CTA → /sale/{linkedCe.slug}</span>
                  {linkedCe.coupon_code && (
                    <span>Code: <strong className="font-mono">{linkedCe.coupon_code}</strong></span>
                  )}
                  {linkedCe.discount_type && linkedCe.discount_value != null && (
                    <span>{linkedCe.discount_type === "percent" ? `${linkedCe.discount_value}% off` : `$${linkedCe.discount_value} off`}</span>
                  )}
                  {eventPricingApplied && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Event pricing applied to items
                      {!linkedCe.allow_coupon_stack && " · No coupon stacking"}
                    </span>
                  )}
                  <a
                    href={`/campaigns-admin/${linkedCe.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-violet-800 dark:hover:text-violet-300"
                  >
                    Manage campaign ↗
                  </a>
                </div>
                {loadingCampaignProducts && (
                  <p className="text-[11px] text-gray-400 italic">Loading campaign products…</p>
                )}
                {!loadingCampaignProducts && campaignProducts.length > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    ✓ {campaignProducts.length} campaign product{campaignProducts.length !== 1 ? "s" : ""} auto-selected
                    {campaignProducts.some((p) => p.is_featured_for_email) && " (featured first)"}
                  </p>
                )}
                {!loadingCampaignProducts && campaignProducts.length === 0 && (
                  <p className="text-[11px] text-gray-400 italic">No products in this campaign yet — select manually below.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── STEP 1: Template Selection ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">1</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {suggestedPresetKeys.size > 0 ? "Template" : "Campaign Type"}
            </h2>
            {suggestedPresetKeys.size > 0 && (
              <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">Suggested for this campaign</span>
            )}
          </div>

          {suggestedPresetKeys.size > 0 && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3 leading-snug">
              Highlighted templates match your campaign category. All templates are available below.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.entries(CAMPAIGN_PRESETS) as [keyof typeof CAMPAIGN_PRESETS, typeof CAMPAIGN_PRESETS[keyof typeof CAMPAIGN_PRESETS]][]).map(([key, preset]) => {
              const c = getColor(preset.color);
              const isActive    = selectedPreset === key;
              const isSuggested = suggestedPresetKeys.has(key as string) && !isActive;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectPreset(key as string)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                    isActive
                      ? `${c.active} dark:border-opacity-60`
                      : isSuggested
                        ? `${c.suggested} ${c.card}`
                        : `border-gray-200 dark:border-gray-700 ${c.card} hover:bg-gray-50 dark:hover:bg-gray-800`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                    <span className="font-semibold text-gray-900 dark:text-white">{preset.emoji} {preset.label}</span>
                    {isSuggested && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400">✦</span>
                    )}
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
              Select a template to populate default content — all fields are editable.
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

            <Field label="Urgency Line" optional hint="Shown in small caps below intro. e.g. 'Ends Sunday · Limited pieces'">
              <input type="text" value={form.urgencyLine} onChange={(e) => setField("urgencyLine", e.target.value)}
                placeholder="Ends Sunday · Limited pieces available" className={inputCls} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="CTA Button Text">
                <input type="text" value={form.ctaText} onChange={(e) => setField("ctaText", e.target.value)}
                  placeholder="Shop the Selection" className={inputCls} />
              </Field>
              <Field label="CTA Link" hint="Path or full URL. Should be /sale/[slug] for event campaigns.">
                <input type="text" value={form.ctaLink} onChange={(e) => setField("ctaLink", e.target.value)}
                  placeholder="/products or https://…" className={inputCls} />
              </Field>
            </div>

            {/* ── Discount / Coupon ── */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Discount <span className="ml-1 text-gray-400 font-normal">(optional)</span>
              </label>
              {eventPricingApplied && !linkedCe?.allow_coupon_stack && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 leading-snug">
                  Event pricing is already applied to these items. The discount amount is hidden from the email; only the coupon code (if any) will be shown with event-savings wording.
                </p>
              )}
              <div className="flex gap-2 mb-3">
                {(["none", "percentage", "fixed"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField("discountType", t)}
                    disabled={eventPricingApplied && !linkedCe?.allow_coupon_stack && t !== "none"}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      form.discountType === t
                        ? "bg-emerald-700 border-emerald-700 text-white"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400"
                    }`}
                  >
                    {t === "none" ? "No discount" : t === "percentage" ? "% Off" : "$ Off (fixed)"}
                  </button>
                ))}
              </div>

              {form.discountType !== "none" && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {form.discountType === "percentage" ? "Percentage off" : "Amount off (USD)"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                          {form.discountType === "percentage" ? "%" : "$"}
                        </span>
                        <input
                          type="number" min="1" max={form.discountType === "percentage" ? "100" : undefined}
                          step={form.discountType === "percentage" ? "1" : "0.01"}
                          value={form.discountValue} onChange={(e) => setField("discountValue", e.target.value)}
                          placeholder={form.discountType === "percentage" ? "20" : "50"}
                          className={`${inputCls} pl-8`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Discount code <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input type="text" value={form.discountCode}
                        onChange={(e) => setField("discountCode", e.target.value.toUpperCase())}
                        placeholder="e.g. JADE20"
                        className={`${inputCls} font-mono uppercase tracking-widest`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Valid through <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={form.expiryDate}
                      onChange={(e) => setField("expiryDate", e.target.value)}
                      placeholder="e.g. May 31, 2026" className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Coupon-only row when event pricing is applied and discount type is "none" */}
              {form.discountType === "none" && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Coupon code <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={form.discountCode}
                      onChange={(e) => setField("discountCode", e.target.value.toUpperCase())}
                      placeholder="e.g. JADE20"
                      className={`${inputCls} font-mono uppercase tracking-widest`}
                    />
                    {form.discountCode && eventPricingApplied && !linkedCe?.allow_coupon_stack && (
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        Email will say: &ldquo;Use code {form.discountCode} for eligible event savings&rdquo;
                      </p>
                    )}
                    {form.discountCode && !eventPricingApplied && (
                      <p className="mt-1 text-[10px] text-gray-400">
                        Email will say: &ldquo;Use code {form.discountCode} on selected event pieces&rdquo;
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Valid through <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={form.expiryDate}
                      onChange={(e) => setField("expiryDate", e.target.value)}
                      placeholder="e.g. May 31, 2026" className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── STEP 3: Products ── */}
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center">3</span>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {showCampaignProducts ? "Campaign Products" : "Featured Products"}
              </h2>
              {!showCampaignProducts && <span className="text-[10px] text-gray-400 font-normal">(optional)</span>}
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

          {showCampaignProducts ? (
            <>
              {eventPricingApplied && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-3">
                  Showing event prices. Email product cards will display event price and crossed-out list price.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {campaignProducts.map((p) => {
                  const isSelected  = selectedProducts.has(p.id);
                  const eventPrice  = p.event_price_usd;
                  const listPrice   = p.price_display_usd;
                  const hasDiscount = eventPrice != null && listPrice != null && eventPrice < listPrice;
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
                        {p.is_featured_for_email && (
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-violet-600 text-white rounded-full px-1.5 py-0.5">
                            Featured
                          </span>
                        )}
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
                        {p.show_price && (
                          hasDiscount
                            ? <p className="text-[11px]">
                                <span className="font-bold text-amber-700">${eventPrice!.toFixed(2)}</span>
                                {" "}
                                <span className="text-gray-400 line-through text-[10px]">${listPrice!.toFixed(2)}</span>
                              </p>
                            : listPrice != null
                              ? <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">${listPrice.toFixed(2)}</p>
                              : null
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.map((p) => {
                const isSelected = selectedProducts.has(p.id);
                const price = p.sale_price_usd ?? p.price_display_usd;
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
          )}
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
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
            <p>
              ✓ Sent to <strong>{result.sent}</strong> subscriber{result.sent !== 1 ? "s" : ""}.
              {result.failed > 0 ? ` ${result.failed} failed.` : ""}
            </p>
            {result.couponCreated && form.discountCode && (
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                Coupon <strong className="font-mono tracking-wide">{form.discountCode.toUpperCase()}</strong> created and active in your coupon system.
              </p>
            )}
            {!result.couponCreated && form.discountType !== "none" && form.discountCode && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Note: coupon <strong className="font-mono tracking-wide">{form.discountCode.toUpperCase()}</strong> already existed — existing settings were kept.
              </p>
            )}
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
