"use client";

import { useState } from "react";

type SourcingStatus =
  | "queued" | "in_progress" | "awaiting_response" | "responded"
  | "accepted_pending_checkout" | "fulfilled" | "cancelled" | "closed";

interface AttemptOption {
  id: string;
  title: string;
  images_json: string[];
  price_cents: number;
  tier: string | null;
  color: string | null;
  dimensions: string | null;
  notes: string | null;
  status: string;
  customer_reaction: "liked" | "disliked" | "neutral" | null;
  customer_note: string | null;
  sort_order: number | null;
}

interface Attempt {
  id: string;
  attempt_number: number;
  status: string;
  sent_at: string | null;
  response_due_at: string | null;
  responded_at: string | null;
  customer_feedback: string | null;
  sourcing_attempt_options: AttemptOption[];
}

interface SourcingData {
  id: string;
  public_token: string;
  customer_name: string;
  customer_email: string;
  category: string;
  budget_min: number;
  budget_max: number | null;
  request_type: string;
  max_attempts: number;
  attempts_used: number;
  sourcing_status: SourcingStatus;
  payment_status: string;
  credit_expires_at: string | null;
  deposit_amount_cents: number;
  attempts: Attempt[];
  availableCreditCents: number;
}

interface Props {
  token: string;
  data: SourcingData;
}

const STATUS_INFO: Record<SourcingStatus, { label: string; color: string; description: string }> = {
  queued: {
    label: "In Queue",
    color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    description: "Your request is confirmed and in our queue. We'll reach out once we've sourced options for you.",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    description: "We're actively sourcing options for your request. You'll receive an email when your options are ready.",
  },
  awaiting_response: {
    label: "Options Ready",
    color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    description: "Your sourcing options are ready to review below. Please respond before the deadline.",
  },
  responded: {
    label: "Responded",
    color: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
    description: "Thank you for your feedback! We'll review it and follow up with next steps.",
  },
  accepted_pending_checkout: {
    label: "Checkout Ready",
    color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    description: "You've accepted an option. Your private checkout link has been sent to your email — your sourcing deposit has been applied as a discount.",
  },
  fulfilled: {
    label: "Complete",
    color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    description: "Your order is complete! Thank you for choosing BingBing Jade.",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    description: "This sourcing request has been cancelled.",
  },
  closed: {
    label: "Closed",
    color: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    description: "This sourcing request has been closed.",
  },
};

const TIER_LABELS: Record<string, string> = {
  standard:  "Standard",
  premium:   "Premium",
  concierge: "Concierge",
};

export function SourcingTracker({ token, data }: Props) {
  const status = data.sourcing_status;
  const statusInfo = STATUS_INFO[status] ?? STATUS_INFO.queued;

  // Active attempt = most recent "sent" or "responded" one within deadline
  const activeAttempt = [...data.attempts]
    .reverse()
    .find((a) =>
      (a.status === "sent" || a.status === "responded") &&
      (!a.response_due_at || new Date(a.response_due_at) > new Date())
    ) ?? null;

  const [reactions, setReactions] = useState<Record<string, "liked" | "disliked" | "neutral">>(() => {
    const init: Record<string, "liked" | "disliked" | "neutral"> = {};
    for (const a of data.attempts) {
      for (const o of a.sourcing_attempt_options) {
        if (o.customer_reaction) init[o.id] = o.customer_reaction;
      }
    }
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of data.attempts) {
      for (const o of a.sourcing_attempt_options) {
        if (o.customer_note) init[o.id] = o.customer_note;
      }
    }
    return init;
  });
  const [generalFeedback, setGeneralFeedback] = useState(activeAttempt?.customer_feedback ?? "");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(!!activeAttempt?.customer_feedback);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitFeedback() {
    if (!activeAttempt) return;
    setSubmittingFeedback(true); setError(null);
    try {
      const optionReactions = activeAttempt.sourcing_attempt_options.map((o) => ({
        optionId: o.id,
        reaction: reactions[o.id] ?? null,
        note:     notes[o.id] ?? null,
      }));
      const res = await fetch(`/api/sourcing/request/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: activeAttempt.id,
          optionReactions,
          generalFeedback: generalFeedback.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit feedback.");
      setFeedbackSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function acceptOption(optionId: string) {
    if (!activeAttempt) return;
    if (!confirm("Accept this option and proceed to checkout?")) return;
    setAccepting(optionId); setError(null);
    try {
      const res = await fetch(`/api/sourcing/request/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, attemptId: activeAttempt.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create checkout.");
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAccepting(null);
    }
  }

  const pastAttempts = data.attempts.filter((a) =>
    !activeAttempt || a.id !== activeAttempt.id
  );

  return (
    <div className="space-y-6">
      {/* Request summary */}
      <div className="bg-white dark:bg-gray-950 ">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Hello, {data.customer_name.split(" ")[0]}</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {data.category.charAt(0).toUpperCase() + data.category.slice(1)} Sourcing Request
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Budget: ${data.budget_min}{data.budget_max ? `–$${data.budget_max}` : "+"} &middot; {TIER_LABELS[data.request_type] ?? data.request_type} tier
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
          {statusInfo.description}
        </div>
        {data.sourcing_status === "accepted_pending_checkout" && data.availableCreditCents > 0 && (
          <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
            Your ${(data.deposit_amount_cents / 100).toFixed(0)} sourcing deposit has been applied as a discount on your checkout.
          </div>
        )}
      </div>

      {/* Active attempt */}
      {activeAttempt && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-950 overflow-hidden">
          <div className="px-5 py-4 border-b border-violet-100 dark:border-violet-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400 mb-0.5">
                Round {activeAttempt.attempt_number} of {data.max_attempts}
              </p>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Your Options
              </h2>
            </div>
            {activeAttempt.response_due_at && (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">Respond by</p>
                <p className={`text-sm font-semibold ${new Date(activeAttempt.response_due_at) < new Date(Date.now() + 24 * 3600_000) ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"}`}>
                  {new Date(activeAttempt.response_due_at).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {activeAttempt.sourcing_attempt_options
              .filter((o) => o.status === "active" || o.status === "responded")
              .map((option) => {
                const reaction = reactions[option.id] ?? null;
                const note = notes[option.id] ?? "";

                return (
                  <div key={option.id} className="px-5 py-5">
                    {/* Option images */}
                    {(option.images_json as string[]).length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                        {(option.images_json as string[]).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${option.title} image ${i + 1}`}
                              className="h-32 w-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{option.title}</h3>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ${(option.price_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </p>
                        <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {option.tier && <span>{option.tier}</span>}
                          {option.color && <span>{option.color}</span>}
                          {option.dimensions && <span>{option.dimensions}</span>}
                        </div>
                        {option.notes && (
                          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{option.notes}</p>
                        )}
                      </div>

                      {/* Accept button */}
                      {!feedbackSent && (
                        <button
                          type="button"
                          onClick={() => acceptOption(option.id)}
                          disabled={!!accepting}
                          className="shrink-0 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {accepting === option.id ? "Processing…" : "Accept & Checkout"}
                        </button>
                      )}
                    </div>

                    {/* Reaction buttons */}
                    {!feedbackSent && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your reaction:</p>
                        <div className="flex gap-2">
                          {(["liked", "neutral", "disliked"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setReactions((prev) => ({ ...prev, [option.id]: r }))}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                reaction === r
                                  ? r === "liked"    ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                  : r === "disliked" ? "border-red-400 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                                  :                   "border-gray-400 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                              }`}
                            >
                              {r === "liked" ? "Liked" : r === "disliked" ? "Not for me" : "Neutral"}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNotes((prev) => ({ ...prev, [option.id]: e.target.value }))}
                          placeholder="Optional note (e.g. love the color but too large)"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {/* Submitted reaction */}
                    {feedbackSent && option.customer_reaction && (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          option.customer_reaction === "liked"    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : option.customer_reaction === "disliked" ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          :                                           "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}>
                          {option.customer_reaction === "liked" ? "You liked this" : option.customer_reaction === "disliked" ? "Not for you" : "Neutral"}
                        </span>
                        {option.customer_note && (
                          <span className="text-xs text-gray-400 italic">"{option.customer_note}"</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* General feedback + submit */}
          {!feedbackSent ? (
            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Any overall feedback for us? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  placeholder="e.g. I prefer something with more green, or size is perfect..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={submittingFeedback}
                  className="px-4 py-2 text-sm font-semibold bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submittingFeedback ? "Submitting…" : "Submit Feedback"}
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  You can also accept an option above to proceed directly to checkout.
                </p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-900">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Thank you for your feedback! We'll review it and follow up soon.
              </p>
              {activeAttempt.customer_feedback && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 italic">"{activeAttempt.customer_feedback}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past attempts (read-only) */}
      {pastAttempts.filter((a) => a.status !== "draft").length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">Previous Rounds</p>
          {pastAttempts
            .filter((a) => a.status !== "draft")
            .map((attempt) => (
              <div key={attempt.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Round {attempt.attempt_number}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {attempt.sent_at && new Date(attempt.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {attempt.sourcing_attempt_options.map((opt) => (
                    <div key={opt.id} className="px-5 py-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{opt.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          ${(opt.price_cents / 100).toLocaleString("en-US")}
                          {opt.tier && ` · ${opt.tier}`}
                        </p>
                      </div>
                      {opt.customer_reaction && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          opt.customer_reaction === "liked"    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : opt.customer_reaction === "disliked" ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          :                                         "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}>
                          {opt.customer_reaction === "liked" ? "Liked" : opt.customer_reaction === "disliked" ? "Not for me" : "Neutral"}
                        </span>
                      )}
                    </div>
                  ))}
                  {attempt.customer_feedback && (
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40">
                      <p className="text-xs text-gray-400 dark:text-gray-500">Feedback: <em className="text-gray-600 dark:text-gray-300">"{attempt.customer_feedback}"</em></p>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Empty state for queued/in_progress */}
      {(status === "queued" || status === "in_progress") && data.attempts.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-6 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">We're sourcing your options</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            You'll receive an email at {data.customer_email} when your options are ready to review.
          </p>
        </div>
      )}

      {/* Fulfilled */}
      {status === "fulfilled" && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-6 py-8 text-center">
          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Order Complete</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Your jade piece is on its way. Thank you for choosing BingBing Jade!
          </p>
        </div>
      )}
    </div>
  );
}
