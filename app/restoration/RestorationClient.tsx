"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ServiceRequestImageUploader, type UploadedAttachment } from "./ServiceRequestImageUploader";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientType = "new" | "bingbing_client";
type ServiceType = "polishing" | "silver_wrapping" | "gold_wrapping";

const MIN_IMAGES = 1;
const MAX_IMAGES = 5;

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
      className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${checked
        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
        : "border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-stone-300 dark:hover:border-gray-600"
        }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center ${checked ? "border-emerald-500 bg-emerald-500" : "border-stone-400 dark:border-gray-600"
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

  // Draft / attachments — the service_requests row is created lazily on first
  // image upload, and images must be validated before any submit/payment.
  const draftIdRef = useRef<Promise<string> | null>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedMode, setSubmittedMode] = useState<"quote_required" | "authorization_hold" | "instant_purchase" | null>(null);

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

  // Reset service-specific state when service changes — a draft/attachments
  // belong to one specific service_requests row, so switching services means
  // starting a fresh draft.
  useEffect(() => {
    setSubmitError(null);
    setSubmittedMode(null);
    draftIdRef.current = null;
    setAttachments([]);
  }, [service]);

  const getServiceRequestId = useCallback(async (): Promise<string> => {
    if (!draftIdRef.current) {
      if (!service) throw new Error("No service selected.");
      draftIdRef.current = fetch("/api/service-requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSlug: service }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to start request.");
          return data.id as string;
        })
        .catch((err) => {
          draftIdRef.current = null; // allow retry on next upload attempt
          throw err;
        });
    }
    return draftIdRef.current;
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

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return;
    if (!name.trim() || !email.trim()) {
      setSubmitError("Please provide your name and email before proceeding.");
      return;
    }
    if (attachments.length < MIN_IMAGES) {
      setSubmitError(`Please upload at least ${MIN_IMAGES} photo of your jade item before submitting.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const serviceRequestId = await getServiceRequestId();
      const fullNotes = [
        notes.trim(),
        banglesFromBingBing ? `Purchased from BingBing Jade: ${banglesFromBingBing === "yes" ? "Yes" : "No"}` : "",
      ].filter(Boolean).join("\n\n");

      const submitRes = await fetch(`/api/service-requests/${serviceRequestId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim() || undefined,
          notes: fullNotes || undefined,
          clientType: clientType === "bingbing_client" ? "existing_client" : "new",
          verified,
          verifiedOrderNumber: verified ? verifyOrder.trim() : undefined,
        }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        setSubmitError(submitData.error ?? "Unable to submit your request. Please try again.");
        return;
      }

      const mode = submitData.workflowMode as "quote_required" | "authorization_hold" | "instant_purchase";

      if (mode === "quote_required") {
        setSubmittedMode("quote_required");
        return;
      }

      // authorization_hold / instant_purchase → proceed to Stripe checkout
      const checkoutRes = await fetch(`/api/service-requests/${serviceRequestId}/checkout`, { method: "POST" });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        setSubmitError(checkoutData.error ?? "Unable to start checkout. Please try again.");
        return;
      }
      if (checkoutData.url) window.location.href = checkoutData.url;
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const polishingPrice = clientType === "bingbing_client" && verified ? 50 : 100;
  const polishingTimeline = clientType === "bingbing_client" && verified ? "2–4 weeks" : "4–6 weeks";
  const needsVerification = clientType === "bingbing_client" && !verified;
  const isWrapping = service === "silver_wrapping" || service === "gold_wrapping";
  const hasEnoughImages = attachments.length >= MIN_IMAGES;

  if (checkoutSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-stone-800 dark:text-gray-100">Request Confirmed</h2>
          <p className="text-stone-600 dark:text-gray-400 leading-relaxed">
            Thank you for your jade bangle polishing request. We&apos;ve placed an authorization hold on your card —
            you have not been charged yet. Our specialists are reviewing your submitted photos and will be in touch
            shortly with our decision and next steps.
          </p>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Please do not ship your item until you receive approval and shipping instructions.
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
      <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
        <Image
          src="/gallery/IMG_4331.jpg"
          alt="Jade bangle preservation"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/65" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 mb-3">
            BingBing Jade
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white leading-tight drop-shadow">
            Jade Bangle Preservation Services
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
            Thoughtful polishing and protective metal wrapping for jade pieces worth preserving.
          </p>
          <a
            href="#request"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-sm px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Start Service Request
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7-7 7" /></svg>
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">

        {/* ── About section ──────────────────────────────────────────────── */}
        <section className="prose prose-stone dark:prose-invert max-w-none">
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-2 sm:space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-stone-800 dark:text-gray-100 not-prose">
                A Tradition of Care
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-gray-400 leading-relaxed">
                In Chinese jade culture, a bangle is more than an ornament — it is a living keepsake. Over time, even the most carefully worn jade can develop surface wear, micro-abrasions, or vulnerable stress points. Preservation is not restoration in the repair sense; it is an act of continued care for a piece that holds lasting meaning.
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-gray-400 leading-relaxed">
                Our polishing service revives surface brilliance while our protective metal wrapping — available in silver or gold — reinforces the bangle structurally and aesthetically, helping extend its wearability for generations.
              </p>
              <Image
                src="/gallery/imag2.png"
                alt="Jade bangle preservation"
                priority
                className="object-cover object-center w-full rounded-lg mt-2"
                width={400}
                height={400}
              />
            </div>

            <div className="space-y-2 sm:space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-stone-800 dark:text-gray-100 not-prose">
                About Metal Wrapping
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-gray-400 leading-relaxed">
                Protective metal wrapping uses fine silver or gold metalwork to reinforce vulnerable areas of a bangle — including visible lines, thin sections, or areas prone to stress. The wrapping may help cover surface imperfections and reduce the risk of further wear, while adding an elegant, bespoke finish.
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-gray-400 leading-relaxed">
                Final feasibility depends on a physical inspection of your piece. Metal wrapping does not guarantee prevention of future damage, and pricing varies based on metal choice, design complexity, bangle condition, and the artisan&apos;s final quote.
              </p>
              <Image
                src="/gallery/image.png"
                alt="Jade bangle preservation"
                priority
                className="object-cover object-center w-full rounded-lg mt-2"
                width={400}
                height={400}
              />
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
              <p className="text-[12px] sm:text-[16px] text-stone-500 dark:text-gray-400 leading-relaxed">
                Professional surface polishing that restores natural luster and removes light abrasions. Best for bangles that have lost their sheen from daily wear.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Estimated timeline: 4–6 weeks
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Photos reviewed before payment is captured
                </span>
              </div>
            </div>

            {/* BingBing Client Polishing */}
            <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-stone-800 dark:text-gray-100">BingBing Jade Client Polishing</h3>
                  <p className="text-[11px] sm:text-[13px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">For existing clients</p>
                </div>
                <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">$50</span>
              </div>
              <p className="text-[12px] sm:text-[16px] text-stone-500 dark:text-gray-400 leading-relaxed">
                A loyalty rate for clients who have purchased from BingBing Jade. Requires verification of your order number, phone, and ZIP code before checkout.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Estimated timeline: 2–4 weeks
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
              <p className="text-[12px] sm:text-[16px] text-stone-500 dark:text-gray-400 leading-relaxed">
                Fine silver metalwork applied to reinforce and protect vulnerable bangle areas. Design and pricing are custom to each piece — subject to artisan quote after inspection.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Timeline subject to quote
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[13px] font-medium text-stone-500 dark:text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  Photos &amp; quote required — no direct checkout
                </span>
              </div>
            </div>

            {/* Gold Wrapping */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-800 dark:text-gray-100">Gold Protective Wrapping</h3>
                <span className="text-lg font-semibold text-amber-700 dark:text-amber-400 shrink-0">$400+</span>
              </div>
              <p className="text-[12px] sm:text-[16px] text-stone-500 dark:text-gray-400 leading-relaxed">
                Premium gold metalwork for bangles of the highest sentimental or monetary value. Pricing reflects metal choice, design intricacy, bangle condition, and artisan hours — subject to final quote.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Timeline subject to quote
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-[13px] font-medium text-stone-500 dark:text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  Photos &amp; quote required — no direct checkout
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
              Select your client type and service below. All requests require photos before we can confirm whether we can accept the piece.
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-8">

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
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
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

              {/* Step 3 — Contact info + photos (shown once service is selected) */}
              {service && (
                <div>
                  <SectionHeading step={3} title="Your contact information and photos" />
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
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${banglesFromBingBing === v
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

                    <ServiceRequestImageUploader
                      getServiceRequestId={getServiceRequestId}
                      uploadUrl={(id) => `/api/service-requests/${id}/attachments`}
                      deleteUrl={(id, attachmentId) => `/api/service-requests/${id}/attachments/${attachmentId}`}
                      minImages={MIN_IMAGES}
                      maxImages={MAX_IMAGES}
                      onChange={setAttachments}
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}

              {/* CTA */}
              {service && !submittedMode && (
                <div className="rounded-2xl border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-900 p-5 space-y-4">
                  {service === "polishing" && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-stone-700 dark:text-gray-300">
                          {clientType === "bingbing_client" && verified ? "BingBing Jade Client Polishing" : "Standard Polishing"}
                        </span>
                        <span className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">${polishingPrice}.00</span>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-gray-500 mt-0.5">
                        Estimated {polishingTimeline} · Card authorized after submission, charged only once your photos are approved
                      </p>
                    </div>
                  )}

                  {service === "polishing" && needsVerification && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      Complete the verification above to unlock the $50 BingBing Jade client rate. Or proceed at the standard $100 rate by switching to &ldquo;New Client&rdquo;.
                    </p>
                  )}

                  {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !hasEnoughImages ||
                      !name.trim() ||
                      !email.trim() ||
                      (service === "polishing" && clientType === "bingbing_client" && !verified)
                    }
                    className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? "Submitting…"
                      : !hasEnoughImages
                        ? `Upload at least ${MIN_IMAGES} photo to continue`
                        : service === "polishing"
                          ? (clientType === "bingbing_client" && !verified ? "Verify above to proceed" : `Continue to Payment Authorization — $${polishingPrice}.00`)
                          : "Submit Request for Quote"}
                  </button>
                  <p className="text-[11px] text-stone-400 dark:text-gray-600 text-center">
                    {service === "polishing"
                      ? "We'll place an authorization hold (you won't be charged yet) while we review your photos, then follow up with our decision and next steps."
                      : "We'll review your photos and follow up with a personalized quote. No payment is required to submit your request."}
                  </p>
                </div>
              )}

              {submittedMode === "quote_required" && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-5 py-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Request received — thank you.</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    We&apos;ve received your service request and photos. Our team will review the condition of your jade
                    item before confirming whether we can accept the requested service and preparing your quote. We&apos;ll
                    be in touch within 1–3 business days. Please do not ship your item until you receive approval and
                    shipping instructions.
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
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
        </section>

      </div>
    </div>
  );
}
