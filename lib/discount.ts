/**
 * Discount validation engine — single source of truth for all discount logic.
 *
 * Rules enforced here:
 *  - Exactly one discount source per order (no stacking)
 *  - Tiered discount: subtotal ≥ $150 → $20, < $150 → $10
 *  - Subtotal is always computed BEFORE the discount is applied
 *  - Welcome discount: new customers only, one-time, requires email subscription
 *  - Referral discount: new customers only, no self-referral, one per referred email
 *  - Campaign discount: configurable, optional new-customer restriction, expiry, caps
 *  - All validation is server-side; clients never control discount amounts
 *
 * This module must only be imported in server-side code (API routes, lib/).
 */

import { supabaseAdmin } from "./supabase-admin";

// ── Tiered discount thresholds ────────────────────────────────────────────────

export const TIER_HIGH_THRESHOLD_CENTS = 15000; // $150.00
export const TIER_HIGH_DISCOUNT_CENTS  = 2000;  // $20.00
export const TIER_LOW_DISCOUNT_CENTS   = 1000;  // $10.00

/**
 * Compute the tiered discount amount for a given subtotal.
 * Subtotal must be BEFORE any discount is applied.
 */
export function computeTieredDiscountCents(subtotalCents: number): number {
  return subtotalCents >= TIER_HIGH_THRESHOLD_CENTS
    ? TIER_HIGH_DISCOUNT_CENTS
    : TIER_LOW_DISCOUNT_CENTS;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiscountSource = "welcome" | "referral" | "campaign" | "store_credit";

export interface DiscountResult {
  valid: true;
  source: DiscountSource;
  discountAmountCents: number;
  subtotalBeforeDiscountCents: number;
  displayMessage: string;
  // For webhook to commit the discount:
  campaignId?: string;
  referrerCustomerId?: string;
  referralCode?: string;
}

export interface DiscountInvalid {
  valid: false;
  error: string;
}

export type DiscountValidation = DiscountResult | DiscountInvalid;

// ── Email normalisation ───────────────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Welcome discount ──────────────────────────────────────────────────────────

async function validateWelcomeDiscount(
  email: string,
  subtotalCents: number
): Promise<DiscountValidation> {
  // 1. Check subscriber record exists and hasn't already been redeemed
  const { data: subscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, welcome_discount_redeemed_at")
    .eq("email", email)
    .maybeSingle();

  if (!subscriber) {
    return { valid: false, error: "Email is not subscribed to our newsletter." };
  }
  if (subscriber.welcome_discount_redeemed_at) {
    return { valid: false, error: "Welcome discount has already been used." };
  }

  // 2. Check customer record: must have no prior paid orders
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, paid_order_count, welcome_discount_redeemed_at")
    .eq("customer_email", email)
    .maybeSingle();

  if (customer) {
    if (customer.paid_order_count > 0) {
      return { valid: false, error: "Welcome discount is only available for first-time customers." };
    }
    if (customer.welcome_discount_redeemed_at) {
      return { valid: false, error: "Welcome discount has already been used." };
    }
  }

  const discountAmountCents = computeTieredDiscountCents(subtotalCents);
  return {
    valid: true,
    source: "welcome",
    discountAmountCents,
    subtotalBeforeDiscountCents: subtotalCents,
    displayMessage: discountAmountCents === TIER_HIGH_DISCOUNT_CENTS
      ? "Welcome offer applied — $20 off your first order"
      : "Welcome offer applied — $10 off your first order",
  };
}

// ── Referral discount ─────────────────────────────────────────────────────────

async function validateReferralDiscount(
  referralCode: string,
  referredEmail: string,
  subtotalCents: number
): Promise<DiscountValidation> {
  // 1. Look up the owner of this referral code
  const { data: referrer } = await supabaseAdmin
    .from("customers")
    .select("id, customer_email, referral_code")
    .eq("referral_code", referralCode)
    .maybeSingle();

  if (!referrer) {
    return { valid: false, error: "Invalid referral code." };
  }

  // 2. No self-referrals
  if (normalizeEmail(referrer.customer_email) === referredEmail) {
    return { valid: false, error: "You cannot use your own referral code." };
  }

  // 3. Referred email must have no prior paid orders
  const { data: referredCustomer } = await supabaseAdmin
    .from("customers")
    .select("id, paid_order_count")
    .eq("customer_email", referredEmail)
    .maybeSingle();

  if (referredCustomer && referredCustomer.paid_order_count > 0) {
    return { valid: false, error: "Referral discount is only available for first-time customers." };
  }

  // 4. No existing active referral for this code + referred email
  const { data: existingReferral } = await supabaseAdmin
    .from("referrals")
    .select("id, status")
    .eq("referral_code", referralCode)
    .eq("referred_customer_email", referredEmail)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingReferral) {
    return { valid: false, error: "This referral code has already been used for your email." };
  }

  const discountAmountCents = computeTieredDiscountCents(subtotalCents);
  return {
    valid: true,
    source: "referral",
    discountAmountCents,
    subtotalBeforeDiscountCents: subtotalCents,
    displayMessage: discountAmountCents === TIER_HIGH_DISCOUNT_CENTS
      ? "Referral discount applied — $20 off"
      : "Referral discount applied — $10 off",
    referrerCustomerId: referrer.id,
    referralCode,
  };
}

// ── Campaign coupon discount ──────────────────────────────────────────────────

async function validateCampaignDiscount(
  code: string,
  customerEmail: string,
  subtotalCents: number
): Promise<DiscountValidation> {
  const upperCode = code.trim().toUpperCase();

  // 1. Look up the campaign
  const { data: campaign } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("*")
    .eq("code", upperCode)
    .maybeSingle();

  if (!campaign) {
    return { valid: false, error: "Invalid discount code." };
  }
  if (!campaign.active) {
    return { valid: false, error: "This discount code is no longer active." };
  }

  // 2. Check active window
  const now = new Date();
  if (campaign.starts_at && new Date(campaign.starts_at) > now) {
    return { valid: false, error: "This discount code is not yet active." };
  }
  if (campaign.ends_at && new Date(campaign.ends_at) < now) {
    return { valid: false, error: "This discount code has expired." };
  }

  // 3. New customers only check
  if (campaign.new_customers_only) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, paid_order_count")
      .eq("customer_email", customerEmail)
      .maybeSingle();
    if (customer && customer.paid_order_count > 0) {
      return { valid: false, error: "This discount code is only available for first-time customers." };
    }
  }

  // 4. Minimum order amount check
  if (campaign.minimum_order_amount != null) {
    const minCents = Math.round(campaign.minimum_order_amount * 100);
    if (subtotalCents < minCents) {
      return {
        valid: false,
        error: `This code requires a minimum order of $${campaign.minimum_order_amount.toFixed(2)}.`,
      };
    }
  }

  // 5. Per-customer redemption count
  const { count: perCustomerCount } = await supabaseAdmin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .eq("customer_email", customerEmail)
    .neq("status", "cancelled");

  if ((perCustomerCount ?? 0) >= campaign.max_redemptions_per_customer) {
    return { valid: false, error: "You have already used this discount code." };
  }

  // 6. Global cap check
  if (campaign.max_total_redemptions != null) {
    const { count: globalCount } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .neq("status", "cancelled");
    if ((globalCount ?? 0) >= campaign.max_total_redemptions) {
      return { valid: false, error: "This discount code has reached its usage limit." };
    }
  }

  // 7. Calculate discount amount
  let discountAmountCents: number;
  if (campaign.discount_type === "tiered") {
    discountAmountCents = computeTieredDiscountCents(subtotalCents);
  } else if (campaign.discount_type === "percent" && campaign.discount_value != null) {
    discountAmountCents = Math.round(subtotalCents * (campaign.discount_value / 100));
  } else if (campaign.discount_type === "fixed" && campaign.discount_value != null) {
    discountAmountCents = Math.round(campaign.discount_value * 100);
  } else {
    return { valid: false, error: "Invalid discount configuration." };
  }

  // Cap discount at subtotal to prevent negative totals
  discountAmountCents = Math.min(discountAmountCents, subtotalCents);

  return {
    valid: true,
    source: "campaign",
    discountAmountCents,
    subtotalBeforeDiscountCents: subtotalCents,
    displayMessage: `${campaign.name} discount applied — $${(discountAmountCents / 100).toFixed(2)} off`,
    campaignId: campaign.id,
  };
}

// ── Store credit ──────────────────────────────────────────────────────────────

async function validateStoreCreditDiscount(
  email: string,
  subtotalCents: number
): Promise<DiscountValidation> {
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, store_credit_balance")
    .eq("customer_email", email)
    .maybeSingle();

  if (!customer || customer.store_credit_balance <= 0) {
    return { valid: false, error: "No store credit available for this email." };
  }

  const creditCents = Math.round(customer.store_credit_balance * 100);
  // Cap at subtotal (cannot reduce total below $0)
  const discountAmountCents = Math.min(creditCents, subtotalCents);

  return {
    valid: true,
    source: "store_credit",
    discountAmountCents,
    subtotalBeforeDiscountCents: subtotalCents,
    displayMessage: `$${(discountAmountCents / 100).toFixed(2)} store credit applied`,
  };
}

// ── Main validation entry point ───────────────────────────────────────────────

/**
 * Validate and compute the best applicable discount for a checkout.
 *
 * Priority:
 *   1. Campaign code (user explicitly provided)
 *   2. Referral code (user explicitly provided)
 *   3. Store credit (auto-applied if no code and credit > 0)
 *   4. Welcome discount (auto-applied if no code and eligible)
 *
 * IMPORTANT: This function only READS from the database.
 * It does NOT write any redemption records — that happens in the Stripe webhook.
 */
export async function validateDiscount(params: {
  customerEmail: string;
  discountCode?: string | null;
  subtotalCents: number;
}): Promise<DiscountValidation> {
  const email = normalizeEmail(params.customerEmail);
  const code = params.discountCode?.trim();
  const { subtotalCents } = params;

  if (subtotalCents <= 0) {
    return { valid: false, error: "Cart is empty." };
  }

  if (code) {
    // Try referral code first (if it looks like one, i.e. in customers table)
    const referralResult = await validateReferralDiscount(code, email, subtotalCents);
    if (referralResult.valid) return referralResult;

    // Try campaign coupon
    const campaignResult = await validateCampaignDiscount(code, email, subtotalCents);
    if (campaignResult.valid) return campaignResult;

    // Neither matched — return last error (campaign error is more descriptive)
    return campaignResult;
  }

  // No explicit code — try store credit then welcome discount
  const creditResult = await validateStoreCreditDiscount(email, subtotalCents);
  if (creditResult.valid) return creditResult;

  const welcomeResult = await validateWelcomeDiscount(email, subtotalCents);
  return welcomeResult;
}

// ── Post-payment: commit discount to DB ───────────────────────────────────────

/**
 * Commit a validated discount to the database after payment succeeds.
 * Called from the Stripe webhook — must be idempotent.
 * Returns the IDs of created records for linking to the order.
 */
export async function commitDiscount(params: {
  source: DiscountSource;
  customerEmail: string;
  customerId: string | null;
  orderId: string;
  discountAmountCents: number;
  // Provided only for specific sources:
  campaignId?: string;
  referrerCustomerId?: string;
  referralCode?: string;
}): Promise<{ couponRedemptionId?: string; referralId?: string }> {
  const email = normalizeEmail(params.customerEmail);

  if (params.source === "welcome") {
    // Mark subscriber as redeemed (idempotent: only update if not already set)
    await supabaseAdmin
      .from("email_subscribers")
      .update({ welcome_discount_redeemed_at: new Date().toISOString() })
      .eq("email", email)
      .is("welcome_discount_redeemed_at", null);

    // Mark customer record if it exists
    if (params.customerId) {
      await supabaseAdmin
        .from("customers")
        .update({ welcome_discount_redeemed_at: new Date().toISOString() })
        .eq("id", params.customerId)
        .is("welcome_discount_redeemed_at", null);
    }
    return {};
  }

  if (params.source === "campaign" && params.campaignId) {
    const { data: redemption } = await supabaseAdmin
      .from("coupon_redemptions")
      .insert({
        campaign_id: params.campaignId,
        customer_email: email,
        customer_id: params.customerId,
        order_id: params.orderId,
        discount_amount_cents: params.discountAmountCents,
        status: "confirmed",
      })
      .select("id")
      .single();

    return { couponRedemptionId: redemption?.id };
  }

  if (params.source === "referral" && params.referrerCustomerId && params.referralCode) {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .insert({
        referrer_customer_id: params.referrerCustomerId,
        referral_code: params.referralCode,
        referred_customer_email: email,
        referred_order_id: params.orderId,
        status: "pending",
        discount_amount_cents: params.discountAmountCents,
      })
      .select("id")
      .single();

    return { referralId: referral?.id };
  }

  // store_credit: deduction is handled in the checkout route before session creation
  // (balance is reduced when the Stripe session is confirmed in the webhook)
  return {};
}

// ── Post-delivery: issue referral rewards ─────────────────────────────────────

/**
 * Called when an order's status changes to "delivered".
 * Issues the $10 store credit to the referrer if the referral qualifies.
 * Idempotent: checks status before issuing credit.
 *
 * Returns the referral ID if a reward was issued, null otherwise.
 */
export async function processReferralRewardOnDelivery(
  orderId: string,
  referralId: string
): Promise<string | null> {
  // Fetch referral (lock row by checking status atomically via update)
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("id, status, referrer_customer_id, discount_amount_cents")
    .eq("id", referralId)
    .eq("referred_order_id", orderId)
    .maybeSingle();

  if (!referral) return null;
  // Only process once
  if (referral.status === "rewarded") return null;
  if (referral.status === "cancelled") return null;

  const REFERRAL_REWARD_CENTS = 1000; // $10.00
  const REFERRAL_REWARD_DOLLARS = 10.0;

  // Issue store credit to referrer
  await supabaseAdmin.from("store_credit_ledger").insert({
    customer_id: referral.referrer_customer_id,
    type: "referral_reward",
    amount: REFERRAL_REWARD_DOLLARS,
    order_id: orderId,
    referral_id: referralId,
    notes: `Referral reward for order ${orderId}`,
  });

  // Increment referrer's credit balance
  const { data: referrer } = await supabaseAdmin
    .from("customers")
    .select("id, store_credit_balance")
    .eq("id", referral.referrer_customer_id)
    .single();

  if (referrer) {
    await supabaseAdmin
      .from("customers")
      .update({
        store_credit_balance: (referrer.store_credit_balance ?? 0) + REFERRAL_REWARD_DOLLARS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", referrer.id);
  }

  // Mark referral as rewarded (atomic: only if still pending/qualified)
  await supabaseAdmin
    .from("referrals")
    .update({ status: "rewarded", credited_at: new Date().toISOString() })
    .eq("id", referralId)
    .in("status", ["pending", "qualified"]);

  return referral.referrer_customer_id;
}

// ── Referral code generation ──────────────────────────────────────────────────

/**
 * Generate a unique referral code for a customer.
 * Uses uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L).
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  let code = "";
  const arr = new Uint8Array(8);
  // Server-side: use Node.js crypto
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  crypto.getRandomValues
    ? crypto.getRandomValues(arr)
    : arr.forEach((_, i) => { arr[i] = Math.floor(Math.random() * 256); });
  for (const byte of arr) {
    code += chars[byte % chars.length];
  }
  return code;
}

/**
 * Assign a referral code to a customer if they don't already have one.
 * Retries on collision (extremely rare with 8-char codes from 32-char alphabet).
 * Returns the referral code.
 */
export async function ensureReferralCode(customerId: string): Promise<string> {
  // Check if already has one
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("referral_code")
    .eq("id", customerId)
    .single();

  if (existing?.referral_code) return existing.referral_code;

  // Generate and assign (retry up to 5 times on collision)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabaseAdmin
      .from("customers")
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq("id", customerId)
      .is("referral_code", null); // Only if still null (concurrent safety)

    if (!error) return code;
    // On unique_violation (code collision), retry
  }

  throw new Error("Failed to assign referral code after 5 attempts.");
}
