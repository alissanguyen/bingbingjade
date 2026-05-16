"use client";

import { useState, useEffect, useRef } from "react";
import emailjs from "@emailjs/browser";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientType = "new" | "bingbing_client";
type ServiceType = "polishing" | "silver_wrapping" | "gold_wrapping";

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "mt-1 block w-full rounded-xl border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-stone-900 dark:text-gray-100 placeholder-stone-400 dark:placeholder-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

const labelCls = "block text-sm font-medium text-stone-700 dark:text-gray-300";

function RadioCard({
  checked,
  onChange,
  title,
  description,
  badge,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
        checked
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
          : "border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-stone-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
            checked ? "border-emerald-500 bg-emerald-500" : "border-stone-400 dark:border-gray-600"
          }`}
        >
          {checked && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${checked ? "text-emerald-800 dark:text-emerald-200" : "text-stone-800 dark:text-gray-200"}`}>
              {title}
            </span>
            {badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex-shrink-0 h-7 w-7 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
        {step}
      </span>
      <h3 className="text-base font-semibold text-stone-800 dark:text-gray-100">{title}</h3>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RestorationClient({ checkoutSuccess }: { checkoutSuccess: boolean }) {
  // Step state
  const [clientType, setClientType] = useState<ClientType>("new");
  const [service, setService] = useState<ServiceType | null>(null);

  // Verification (BingBing clients only)
  const [verifyOrder, setVerifyOrder] = useState("");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyPostal, setVerifyPostal] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Contact fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [banglesFromBingBing, setBanglesFromBingBing] = useState<"yes" | "no" | "">("");

  // Submission
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // Populate email from verified order
  useEffect(() => {
    if (verified && verifiedEmail && !email) setEmail(verifiedEmail);
  }, [verified, verifiedEmail, email]);

  // Reset verification when client type changes
  useEffect(() => {
    setVerified(false);
    setVerifyError(null);
    setVerifiedEmail("");
  }, [clientType]);

  // Reset service-specific state when service changes
  useEffect(() => {
    setCheckoutError(null);
    setInquiryError(null);
    setInquirySubmitted(false);
  }, [service]);

  async function handleVerify() {
    setVerifyError(null);
    if (!verifyOrder.trim() || !verifyPhone.trim() || !verifyPostal.trim()) {
      setVerifyError("Please fill in all three fields.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/restoration/verify-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: verifyOrder.trim(),
          phone: verifyPhone.trim(),
          postalCode: verifyPostal.trim(),
        }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerified(true);
        setVerifiedEmail(data.customerEmail ?? "");
      } else {
        setVerifyError(data.error ?? "Verification failed. Please check your details.");
      }
    } catch {
      setVerifyError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handlePolishingCheckout() {
    if (!name.trim() || !email.trim()) {
      setCheckoutError("Please provide your name and email before proceeding.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/restoration/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientType,
          verified,
          verifiedOrderNumber: verified ? verifyOrder.trim() : undefined,
          customerEmail: email.trim(),
          customerName: name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error ?? "Unable to start checkout. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleInquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setInquiryLoading(true);
    setInquiryError(null);

    const serviceLabel =
      service === "silver_wrapping"
        ? "Silver Protective Wrapping (Starting at $250+)"
        : "Gold Protective Wrapping (Starting at $400+)";

    const messageBody = [
      `Service Requested: ${serviceLabel}`,
      `Client Type: ${clientType === "bingbing_client" ? "BingBing Jade Client" : "New Client"}`,
      ...(clientType === "bingbing_client" && verifyOrder ? [`Order Number (unverified): ${verifyOrder}`] : []),
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      ...(phone.trim() ? [`Phone: ${phone}`] : []),
      ...(banglesFromBingBing ? [`Bangle purchased from BingBing Jade: ${banglesFromBingBing === "yes" ? "Yes" : "No"}`] : []),
      "",
      `Notes / Concerns:`,
      notes.trim() || "(none provided)",
      "",
      "---",
      "service_type: " + service,
      "client_type: " + clientType,
      "verified_client: false",
      "quote_required: true",
    ].join("\n");

    try {
      const opts = { publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY! };
      await Promise.all([
        emailjs.send(
          process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
          process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
          { from_name: name, from_email: email, name, email, message: messageBody, inquiry_type: "General inquiry", product_names: "", product_public_ids: "", product_categories: "", product_prices: "", product_statuses: "", product_urls: "", product_image_urls: "", primary_product_name: "", primary_product_public_id: "", primary_product_category: "", primary_product_price: "", primary_product_status: "", primary_product_url: "", primary_product_image_url: "", product_count: "0", has_multiple_products: "no" },
          opts
        ),
        emailjs.send(
          process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
          process.env.NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID!,
          { from_name: name, from_email: email, name, email, message: messageBody, inquiry_type: "General inquiry", product_names: "", product_public_ids: "", product_categories: "", product_prices: "", product_statuses: "", product_urls: "", product_image_urls: "", primary_product_name: "", primary_product_public_id: "", primary_product_category: "", primary_product_price: "", primary_product_status: "", primary_product_url: "", primary_product_image_url: "", product_count: "0", has_multiple_products: "no" },
          opts
        ),
      ]);
      setInquirySubmitted(true);
    } catch {
      setInquiryError("Something went wrong sending your inquiry. Please try again or reach out via the contact page.");
    } finally {
      setInquiryLoading(false);
    }
  }

  const polishingPrice = clientType === "bingbing_client" && verified ? 50 : 100;
  const polishingTimeline = clientType === "bingbing_client" && verified ? "2–4 weeks" : "4–6 weeks";
  const needsVerification = clientType === "bingbing_client" && !verified;
  const isWrapping = service === "silver_wrapping" || service === "gold_wrapping";

  if (checkoutSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-stone-800 dark:text-gray-100">Service Confirmed</h2>
          <p className="text-stone-600 dark:text-gray-400 leading-relaxed">
            Thank you for booking your jade bangle polishing service. You&apos;ll receive a confirmation email shortly with instructions on how to ship your bangle to us.
          </p>
          <p className="text-sm text-stone-500 dark:text-gray-500">
            Please handle and package your bangle carefully. We recommend a padded box with bubble wrap.
          </p>
          <a
            href="/restoration"
            className="inline-block mt-2 text-sm text-emerald-700 dark:text-emerald-400 underline underline-offset-4"
          >
            ← Back to Services
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-50 dark:bg-gray-900 border-b border-stone-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-3">
            BingBing Jade
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-gray-50 leading-tight">
            Jade Bangle Preservation Services
          </h1>
          <p className="mt-4 text-base sm:text-lg text-stone-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Thoughtful polishing and protective metal wrapping for jade pieces worth preserving.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">

        {/* ── About section ──────────────────────────────────────────────── */}
        <section className="prose prose-stone dark:prose-invert max-w-none">
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-stone-800 dark:text-gray-100 not-prose">
                A Tradition of Care
              </h2>
              <p className="text-sm sm:text-base text-stone-600 dark:text-gray-400 leading-relaxed">
                In Chinese jade culture, a bangle is more than an ornament — it is a living keepsake. Over time, even the most carefully worn jade can develop surface wear, micro-abrasions, or vulnerable stress points. Preservation is not restoration in the repair sense; it is an act of continued care for a piece that holds lasting meaning.
              </p>
              <p className="text-sm sm:text-base text-stone-600 dark:text-gray-400 leading-relaxed">
                Our polishing service revives surface brilliance while our protective metal wrapping — available in silver or gold — reinforces the bangle structurally and aesthetically, helping extend its wearability for generations.
              </p>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-stone-800 dark:text-gray-100 not-prose">
                About Metal Wrapping
              </h2>
              <p className="text-sm sm:text-base text-stone-600 dark:text-gray-400 leading-relaxed">
                Protective metal wrapping uses fine silver or gold metalwork to reinforce vulnerable areas of a bangle — including visible lines, thin sections, or areas prone to stress. The wrapping may help cover surface imperfections and reduce the risk of further wear, while adding an elegant, bespoke finish.
              </p>
              <p className="text-sm sm:text-base text-stone-600 dark:text-gray-400 leading-relaxed">
                Final feasibility depends on a physical inspection of your piece. Metal wrapping does not guarantee prevention of future damage, and pricing varies based on metal choice, design complexity, bangle condition, and the artisan&apos;s final quote.
              </p>
            </div>
          </div>
        </section>

        {/* ── Service cards ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xl font-semibold text-stone-800 dark:text-gray-100 mb-6">Our Services</h2>
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Standard Polishing */}
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-stone-50 dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-800 dark:text-gray-100">Standard Polishing</h3>
                <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">$100</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400 leading-relaxed">
                Professional surface polishing that restores natural luster and removes light abrasions. Best for bangles that have lost their sheen from daily wear.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Estimated timeline: 4–6 weeks
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Direct checkout available
                </span>
              </div>
            </div>

            {/* BingBing Client Polishing */}
            <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-stone-800 dark:text-gray-100">BingBing Jade Client Polishing</h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">For existing clients</p>
                </div>
                <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">$50</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400 leading-relaxed">
                A loyalty rate for clients who have purchased from BingBing Jade. Requires verification of your order number, phone, and ZIP code before checkout.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Estimated timeline: 2–4 weeks
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Checkout unlocked after verification
                </span>
              </div>
            </div>

            {/* Silver Wrapping */}
            <div className="rounded-2xl border border-stone-200 dark:border-gray-800 bg-stone-50 dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-800 dark:text-gray-100">Silver Protective Wrapping</h3>
                <span className="text-lg font-semibold text-stone-700 dark:text-gray-300 shrink-0">$250+</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400 leading-relaxed">
                Fine silver metalwork applied to reinforce and protect vulnerable bangle areas. Design and pricing are custom to each piece — subject to artisan quote after inspection.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Timeline subject to quote
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Inquiry &amp; quote required — no direct checkout
                </span>
              </div>
            </div>

            {/* Gold Wrapping */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-800 dark:text-gray-100">Gold Protective Wrapping</h3>
                <span className="text-lg font-semibold text-amber-700 dark:text-amber-400 shrink-0">$400+</span>
              </div>
              <p className="text-xs text-stone-500 dark:text-gray-400 leading-relaxed">
                Premium gold metalwork for bangles of the highest sentimental or monetary value. Pricing reflects metal choice, design intricacy, bangle condition, and artisan hours — subject to final quote.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Timeline subject to quote
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Inquiry &amp; quote required — no direct checkout
                </span>
              </div>
            </div>

          </div>

          <p className="mt-4 text-xs text-stone-400 dark:text-gray-600 leading-relaxed">
            All timelines are estimates and may vary. Final service acceptance depends on physical inspection of your piece. Metal wrapping does not guarantee prevention of future damage.
          </p>
        </section>

        {/* ── Service request form ────────────────────────────────────────── */}
        <section ref={formRef} id="request">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-gray-100 mb-2">Start Your Service Request</h2>
            <p className="text-sm text-stone-500 dark:text-gray-400 mb-8">
              Select your client type and service below. Polishing can be booked directly; wrapping services require a quote.
            </p>

            <form onSubmit={handleInquirySubmit} className="space-y-8">

              {/* Step 1 — Client type */}
              <div>
                <SectionHeading step={1} title="Are you an existing BingBing Jade client?" />
                <div className="space-y-2.5">
                  <RadioCard
                    checked={clientType === "new"}
                    onChange={() => setClientType("new")}
                    title="New Client"
                    description="First time requesting a preservation service from BingBing Jade."
                  />
                  <RadioCard
                    checked={clientType === "bingbing_client"}
                    onChange={() => setClientType("bingbing_client")}
                    title="BingBing Jade Client"
                    description="I have previously purchased from BingBing Jade and have an order number."
                    badge="50% off polishing"
                  />
                </div>
              </div>

              {/* Verification block (BingBing clients) */}
              {clientType === "bingbing_client" && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-5 space-y-4">
                  {verified ? (
                    <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <div>
                        <p className="text-sm font-semibold">Client verified</p>
                        <p className="text-xs opacity-75">Discounted polishing rate unlocked.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-stone-800 dark:text-gray-100 mb-0.5">Verify your BingBing Jade order</p>
                        <p className="text-xs text-stone-500 dark:text-gray-400">
                          Enter your order number, the phone number on the order, and the shipping ZIP code to unlock the $50 client rate.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className={labelCls}>Order Number</label>
                          <input
                            type="text"
                            placeholder="e.g. BBJ-1042"
                            value={verifyOrder}
                            onChange={(e) => setVerifyOrder(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Phone Number on Order</label>
                          <input
                            type="tel"
                            placeholder="e.g. (555) 000-0000"
                            value={verifyPhone}
                            onChange={(e) => setVerifyPhone(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Shipping ZIP / Postal Code</label>
                          <input
                            type="text"
                            placeholder="e.g. 98101"
                            value={verifyPostal}
                            onChange={(e) => setVerifyPostal(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        {verifyError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{verifyError}</p>
                        )}
                        <button
                          type="button"
                          onClick={handleVerify}
                          disabled={verifying}
                          className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          {verifying ? "Verifying…" : "Verify My Order"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2 — Service selection */}
              <div>
                <SectionHeading step={2} title="Which service are you interested in?" />
                <div className="space-y-2.5">
                  <RadioCard
                    checked={service === "polishing"}
                    onChange={() => setService("polishing")}
                    title="Polishing"
                    description={
                      clientType === "bingbing_client" && verified
                        ? "$50 · 2–4 weeks · BingBing Jade client rate"
                        : clientType === "bingbing_client"
                        ? "$50 after verification · 2–4 weeks (verify above to unlock)"
                        : "$100 · 4–6 weeks"
                    }
                  />
                  <RadioCard
                    checked={service === "silver_wrapping"}
                    onChange={() => setService("silver_wrapping")}
                    title="Silver Protective Wrapping"
                    description="Starting at $250+ · Subject to artisan quote after inspection"
                  />
                  <RadioCard
                    checked={service === "gold_wrapping"}
                    onChange={() => setService("gold_wrapping")}
                    title="Gold Protective Wrapping"
                    description="Starting at $400+ · Subject to artisan quote after inspection"
                  />
                </div>
              </div>

              {/* Wrapping quote info */}
              {isWrapping && (
                <div className="rounded-xl bg-stone-100 dark:bg-gray-900 border border-stone-200 dark:border-gray-800 px-5 py-4 text-sm text-stone-600 dark:text-gray-400 leading-relaxed space-y-1">
                  <p className="font-medium text-stone-800 dark:text-gray-200">Pricing is subject to quote after review.</p>
                  <p>
                    {service === "silver_wrapping"
                      ? "Silver wrapping generally starts around $250+."
                      : "Gold wrapping generally starts around $400+."}{" "}
                    Final pricing depends on metal choice, design complexity, the condition of your bangle, and the artisan&apos;s assessment. We will reach out with a detailed quote before any work begins.
                  </p>
                </div>
              )}

              {/* Step 3 — Contact info (shown once service is selected) */}
              {service && (
                <div>
                  <SectionHeading step={3} title="Your contact information" />
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Phone Number <span className="text-stone-400 font-normal">(optional)</span></label>
                      <input
                        type="tel"
                        placeholder="(555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Was this bangle purchased from BingBing Jade? <span className="text-stone-400 font-normal">(optional)</span>
                      </label>
                      <div className="mt-2 flex gap-3">
                        {(["yes", "no"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setBanglesFromBingBing(banglesFromBingBing === v ? "" : v)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                              banglesFromBingBing === v
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                : "border-stone-300 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:border-stone-400 dark:hover:border-gray-600"
                            }`}
                          >
                            {v === "yes" ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>
                        Notes or Concerns <span className="text-stone-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Describe your bangle's condition, any visible lines or cracks, your concerns, or any other details that may be helpful…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    {/* Photo upload — TODO */}
                    <div className="rounded-xl border border-dashed border-stone-300 dark:border-gray-700 px-4 py-4 text-center">
                      <p className="text-xs text-stone-400 dark:text-gray-600">
                        📷 Bangle photo upload — coming soon. For now, you may attach photos to your confirmation email or send them via our{" "}
                        <a href="/contact" className="underline underline-offset-2 hover:text-stone-600 dark:hover:text-gray-400 transition-colors">
                          contact page
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA — Polishing checkout */}
              {service === "polishing" && (
                <div className="rounded-2xl border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900 p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-stone-700 dark:text-gray-300">
                        {clientType === "bingbing_client" && verified
                          ? "BingBing Jade Client Polishing"
                          : "Standard Polishing"}
                      </span>
                      <span className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                        ${polishingPrice}.00
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-gray-500 mt-0.5">
                      Estimated {polishingTimeline} · Includes return shipping
                    </p>
                  </div>

                  {needsVerification && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Complete the verification above to unlock the $50 BingBing Jade client rate. Or proceed at the standard $100 rate by switching to &ldquo;New Client&rdquo;.
                    </p>
                  )}

                  {checkoutError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{checkoutError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handlePolishingCheckout}
                    disabled={checkoutLoading || (clientType === "bingbing_client" && !verified)}
                    className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading
                      ? "Preparing checkout…"
                      : clientType === "bingbing_client" && !verified
                      ? "Verify above to proceed"
                      : `Proceed to Checkout — $${polishingPrice}.00`}
                  </button>
                  <p className="text-[11px] text-stone-400 dark:text-gray-600 text-center">
                    You will provide your shipping address on the next screen. After payment, we will send instructions for shipping your bangle to us.
                  </p>
                </div>
              )}

              {/* CTA — Inquiry (wrapping) */}
              {isWrapping && !inquirySubmitted && (
                <div className="space-y-3">
                  {inquiryError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{inquiryError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={inquiryLoading || !name.trim() || !email.trim()}
                    className="w-full rounded-full bg-stone-800 dark:bg-gray-100 hover:bg-stone-900 dark:hover:bg-gray-50 text-white dark:text-gray-900 py-3 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {inquiryLoading ? "Sending…" : "Contact Us for a Quote"}
                  </button>
                  <p className="text-[11px] text-stone-400 dark:text-gray-600 text-center">
                    We&apos;ll review your request and respond within 1–3 business days with a personalized quote.
                  </p>
                </div>
              )}

              {inquirySubmitted && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-5 py-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Inquiry received — thank you.</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    We&apos;ll review your request and be in touch within 1–3 business days with a personalized quote and next steps.
                  </p>
                </div>
              )}

            </form>
          </div>
        </section>

        {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
        <section className="border-t border-stone-200 dark:border-gray-800 pt-10 text-center space-y-3">
          <p className="text-sm text-stone-500 dark:text-gray-400">
            Have questions before submitting? We&apos;re happy to help.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-stone-700 dark:text-gray-300 hover:border-stone-400 dark:hover:border-gray-500 transition-colors"
          >
            Go to Contact Page
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </section>

      </div>
    </div>
  );
}
