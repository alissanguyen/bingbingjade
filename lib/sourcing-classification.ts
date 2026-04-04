// lib/sourcing-classification.ts
// Server-side classification logic for custom sourcing requests.
// This module is the single source of truth for strictness scoring,
// request classification, and deposit amounts.
// The client may mirror this logic for preview UX only — the server always recomputes.

export interface ClassificationInputs {
  closeReferenceMatch: boolean;   // +2 (most restrictive signal)
  exactColorMatters: boolean;     // +1
  patternVeiningMatters: boolean; // +1
  translucencyMatters: boolean;   // +1
  exactDimensionsMatters: boolean; // +1
  mustHaves?: string;             // +1 if 3+ distinct constraints listed
}

export type RequestType = "standard" | "premium";

// Deposit amounts in cents
export const DEPOSIT_CENTS: Record<RequestType, number> = {
  standard: 5000,   // $50
  premium: 10000,   // $100
};

export const CREDIT_VALIDITY_DAYS = 365; // credit expires 1 year after payment

/**
 * Compute a strictness score from the user's preference flags.
 * Score 0-2 = standard; 3+ = premium.
 */
export function computeStrictnessScore(inputs: ClassificationInputs): number {
  let score = 0;

  if (inputs.closeReferenceMatch) score += 2;
  if (inputs.exactColorMatters) score += 1;
  if (inputs.patternVeiningMatters) score += 1;
  if (inputs.translucencyMatters) score += 1;
  if (inputs.exactDimensionsMatters) score += 1;

  // Count distinct must-have constraints (comma / newline / semicolon separated)
  const mustHaveText = (inputs.mustHaves ?? "").trim();
  if (mustHaveText) {
    const items = mustHaveText
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length >= 3) score += 1;
  }

  return score;
}

/**
 * Classify a request as standard or premium based on its strictness score.
 */
export function classifyRequest(score: number): RequestType {
  return score >= 3 ? "premium" : "standard";
}

/**
 * Get deposit amount in cents for a request type.
 */
export function getDepositCents(type: RequestType): number {
  return DEPOSIT_CENTS[type];
}

/**
 * Compute all classification fields from inputs in one call.
 */
export function classifyFromInputs(inputs: ClassificationInputs): {
  score: number;
  requestType: RequestType;
  depositCents: number;
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
