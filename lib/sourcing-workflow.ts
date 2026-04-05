/**
 * sourcing-workflow.ts — Core business logic for the custom sourcing workflow.
 * SERVER-SIDE ONLY. Never import in client components.
 */

import { supabaseAdmin } from "./supabase-admin";
import type { RequestType } from "./sourcing-classification";
import { computeAvailableCredit } from "./sourcing-classification";
import { VIDEO_BUCKET } from "./storage";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_ATTEMPTS_BY_TYPE: Record<RequestType, number> = {
  standard:  2,
  premium:   3,
  concierge: 4,
};

export const ATTEMPT_RESPONSE_HOURS = 72;   // 3 days for customer to respond
export const CHECKOUT_OFFER_HOURS   = 72;   // 3 days for customer to complete purchase
export const SHIPPING_CENTS         = 2000; // $20 flat shipping
export const TX_FEE_RATE            = 0.035; // 3.5% transaction fee

// ── Credit helpers ─────────────────────────────────────────────────────────────

export async function getAvailableCredit(sourcingRequestId: string): Promise<{
  depositCents: number;
  availableCents: number;
}> {
  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("deposit_amount_cents, payment_status, credit_expires_at")
    .eq("id", sourcingRequestId)
    .maybeSingle();

  if (!req || req.payment_status !== "paid") {
    return { depositCents: 0, availableCents: 0 };
  }

  const now = new Date();
  if (req.credit_expires_at && new Date(req.credit_expires_at) < now) {
    return { depositCents: req.deposit_amount_cents, availableCents: 0 };
  }

  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", sourcingRequestId);

  const availableCents = computeAvailableCredit(
    req.deposit_amount_cents,
    ledger ?? []
  );
  return { depositCents: req.deposit_amount_cents, availableCents };
}

// ── Checkout pricing ──────────────────────────────────────────────────────────

export function computeCheckoutBreakdown(priceCents: number, availableCreditCents: number) {
  const subtotal = priceCents;
  const creditApplied = Math.min(availableCreditCents, subtotal + SHIPPING_CENTS);
  const afterCredit = subtotal + SHIPPING_CENTS - creditApplied;
  const txFeeCents = Math.round(afterCredit * TX_FEE_RATE);
  const finalAmount = afterCredit + txFeeCents;
  return { subtotal, creditApplied, shipping: SHIPPING_CENTS, txFee: txFeeCents, finalAmount };
}

// ── Customer token lookup ─────────────────────────────────────────────────────

export async function getSourcingRequestByToken(token: string) {
  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select(`
      id, public_token, customer_name, customer_email,
      category, budget_min, budget_max,
      request_type, max_attempts, attempts_used,
      preferences_json, reference_images_json,
      deposit_amount_cents, payment_status, sourcing_status,
      credit_expires_at, paid_at, created_at
    `)
    .eq("public_token", token)
    .maybeSingle();

  if (!req) return null;

  const { data: attempts } = await supabaseAdmin
    .from("sourcing_attempts")
    .select(`
      id, attempt_number, status,
      sent_at, response_due_at, responded_at, customer_feedback,
      sourcing_attempt_options (
        id, title, images_json, videos_json, price_cents, tier, color, dimensions, notes,
        status, customer_reaction, customer_note, sort_order
      )
    `)
    .eq("sourcing_request_id", req.id)
    .order("attempt_number", { ascending: true });

  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", req.id);

  const availableCreditCents = computeAvailableCredit(
    req.deposit_amount_cents,
    ledger ?? []
  );

  // Collect all video paths across all options and resolve to signed URLs in one batch
  type RawOption = {
    id: string; title: string; images_json: string[]; videos_json: string[];
    price_cents: number; tier: string | null; color: string | null;
    dimensions: string | null; notes: string | null; status: string;
    customer_reaction: string | null; customer_note: string | null; sort_order: number | null;
  };

  const allVideoPaths: string[] = [];
  for (const a of attempts ?? []) {
    for (const o of (a.sourcing_attempt_options ?? []) as RawOption[]) {
      for (const p of (o.videos_json ?? []) as string[]) {
        if (p && !p.startsWith("http")) allVideoPaths.push(p);
      }
    }
  }

  const signedMap = new Map<string, string>();
  if (allVideoPaths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .createSignedUrls(allVideoPaths, 60 * 60 * 24 * 7); // 7-day TTL
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
    }
  }

  // Sort options and resolve video URLs
  const attemptsWithSortedOptions = (attempts ?? []).map((a) => ({
    ...a,
    sourcing_attempt_options: [...((a.sourcing_attempt_options ?? []) as RawOption[])]
      .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
      .map((o) => ({
        ...o,
        videos_json: ((o.videos_json ?? []) as string[]).map(
          (p) => (signedMap.get(p) ?? p)
        ),
      })),
  }));

  return { ...req, attempts: attemptsWithSortedOptions, availableCreditCents };
}

// ── Attempt helpers ────────────────────────────────────────────────────────────

export async function getAttemptWithOptions(attemptId: string) {
  const { data } = await supabaseAdmin
    .from("sourcing_attempts")
    .select(`
      id, sourcing_request_id, attempt_number, status,
      sent_at, response_due_at, responded_at, customer_feedback, admin_notes,
      sourcing_attempt_options (
        id, title, images_json, price_cents, tier, color, dimensions, notes,
        status, customer_reaction, customer_note, sort_order, source_product_id
      )
    `)
    .eq("id", attemptId)
    .maybeSingle();
  return data;
}

// ── Automated expiry (call from maintenance cron route) ───────────────────────

export async function expireStaleAttempts(): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  const { data: stale } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, sourcing_request_id")
    .eq("status", "sent")
    .lt("response_due_at", now);

  if (!stale?.length) return { expired: 0 };

  const ids = stale.map((a) => a.id);

  await supabaseAdmin
    .from("sourcing_attempts")
    .update({ status: "expired", updated_at: now })
    .in("id", ids);

  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "expired", updated_at: now })
    .in("attempt_id", ids)
    .in("status", ["draft", "active"]);

  // Per-request: update status and check if exhausted
  const affectedRequestIds = [...new Set(stale.map((a) => a.sourcing_request_id as string))];
  for (const reqId of affectedRequestIds) {
    const { data: req } = await supabaseAdmin
      .from("sourcing_requests")
      .select("sourcing_status, max_attempts, attempts_used")
      .eq("id", reqId)
      .maybeSingle();

    if (!req) continue;
    if (req.sourcing_status !== "awaiting_response") continue;

    const newStatus =
      (req.attempts_used ?? 0) >= (req.max_attempts ?? 2) ? "closed" : "in_progress";

    await supabaseAdmin
      .from("sourcing_requests")
      .update({ sourcing_status: newStatus, updated_at: now })
      .eq("id", reqId);
  }

  return { expired: ids.length };
}

export async function expireStaleCheckoutOffers(): Promise<{ expired: number }> {
  const now = new Date().toISOString();

  const { data: stale } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, sourcing_request_id, sourcing_attempt_option_id")
    .eq("status", "pending_checkout")
    .lt("expires_at", now);

  if (!stale?.length) return { expired: 0 };

  const ids = stale.map((o) => o.id);
  const optionIds = stale.map((o) => o.sourcing_attempt_option_id as string);

  await supabaseAdmin
    .from("sourcing_checkout_offers")
    .update({ status: "expired", updated_at: now })
    .in("id", ids);

  // Revert options so customer can re-accept
  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "active", updated_at: now })
    .in("id", optionIds)
    .eq("status", "converted_to_checkout");

  // Reset request status to awaiting_response if it was accepted_pending_checkout
  const reqIds = [...new Set(stale.map((o) => o.sourcing_request_id as string))];
  for (const reqId of reqIds) {
    await supabaseAdmin
      .from("sourcing_requests")
      .update({ sourcing_status: "awaiting_response", updated_at: now })
      .eq("id", reqId)
      .eq("sourcing_status", "accepted_pending_checkout");
  }

  return { expired: ids.length };
}
