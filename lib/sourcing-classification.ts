// lib/sourcing-classification.ts
// Server-side classification logic for custom sourcing requests.
// This module is the single source of truth for strictness scoring,
// request classification, and deposit amounts.
// The client may mirror this logic for preview UX only — the server always recomputes.

export interface ClassificationInputs {
  closeReferenceMatch: boolean;    // +3 (most restrictive signal)
  exactColorMatters: boolean;      // +2
  patternVeiningMatters: boolean;  // +2
  translucencyMatters: boolean;    // +2
  exactDimensionsMatters: boolean; // +1
}

export type RequestType = "standard" | "premium" | "concierge";
export type Timeline = "asap" | "within_1_month" | "1-2_months" | "within_3_months";

// Base deposit amounts by tier (in cents)
export const BASE_DEPOSIT_CENTS: Record<RequestType, number> = {
  standard:  5000,   // $50
  premium:   10000,  // $100
  concierge: 15000,  // $150
};

// Backward-compat alias
export const DEPOSIT_CENTS = BASE_DEPOSIT_CENTS;

// Timeline urgency surcharges (in cents, added on top of base deposit)
export const TIMELINE_SURCHARGE_CENTS: Record<Timeline, number> = {
  within_3_months: 0,     // +$0
  "1-2_months":    1000,  // +$10
  within_1_month:  2500,  // +$25
  asap:            5000,  // +$50
};

export const CREDIT_VALIDITY_DAYS = 365; // credit expires 1 year after payment (fallback)

/**
 * Compute a strictness score from the user's preference flags.
 *   0–1  = standard
 *   2–4  = premium
 *   5+   = concierge
 */
export function computeStrictnessScore(inputs: ClassificationInputs): number {
  let score = 0;
  if (inputs.closeReferenceMatch) score += 3;
  if (inputs.exactColorMatters)   score += 2;
  if (inputs.patternVeiningMatters) score += 2;
  if (inputs.translucencyMatters)   score += 2;
  if (inputs.exactDimensionsMatters) score += 1;
  return score;
}

/**
 * Classify a request as standard, premium, or concierge based on its strictness score.
 */
export function classifyRequest(score: number): RequestType {
  if (score >= 5) return "concierge";
  if (score >= 2) return "premium";
  return "standard";
}

/**
 * Get the base deposit amount in cents for a request type (excludes timeline surcharge).
 */
export function getDepositCents(type: RequestType): number {
  return BASE_DEPOSIT_CENTS[type];
}

/**
 * Get the timeline urgency surcharge in cents.
 */
export function getTimelineSurchargeCents(timeline: string): number {
  return TIMELINE_SURCHARGE_CENTS[timeline as Timeline] ?? 0;
}

/**
 * Compute total deposit = base + timeline surcharge.
 */
export function computeTotalDepositCents(type: RequestType, timeline: string): number {
  return BASE_DEPOSIT_CENTS[type] + getTimelineSurchargeCents(timeline);
}

/**
 * Compute all classification fields from inputs in one call.
 * Returns base depositCents only — add timeline surcharge separately.
 */
export function classifyFromInputs(inputs: ClassificationInputs): {
  score: number;
  requestType: RequestType;
  depositCents: number; // base only
} {
  const score = computeStrictnessScore(inputs);
  const requestType = classifyRequest(score);
  const depositCents = getDepositCents(requestType);
  return { score, requestType, depositCents };
}

// ── Credit helpers ─────────────────────────────────────────────────────────────

export interface LedgerRow {
  event_type: "credit_created" | "credit_consumed" | "credit_refunded" | "credit_expired";
  amount_cents: number;
}

/**
 * Compute the available balance from a set of ledger rows.
 * credit_created and credit_refunded add; credit_consumed and credit_expired subtract.
 */
export function computeAvailableCredit(
  depositAmountCents: number,
  ledger: LedgerRow[]
): number {
  const totalCreated = ledger
    .filter((r) => r.event_type === "credit_created" || r.event_type === "credit_refunded")
    .reduce((s, r) => s + r.amount_cents, 0);

  const totalConsumed = ledger
    .filter((r) => r.event_type === "credit_consumed" || r.event_type === "credit_expired")
    .reduce((s, r) => s + r.amount_cents, 0);

  // Safety cap: never return more than the original deposit
  return Math.max(0, Math.min(depositAmountCents, totalCreated - totalConsumed));
}
