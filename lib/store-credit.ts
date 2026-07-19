// lib/store-credit.ts
//
// Admin-issued, code-redeemed, conditional store credit — distinct from the
// older auto-applied customers.store_credit_balance / store_credit_ledger
// system (lib/discount.ts) used for referral rewards, which this module does
// not touch.
//
// Store credit is a payment method, not a promotional discount: it is never
// written to orders.discount_source / discount_amount_cents, and its
// eligibility rules are independent of the discount-code stacking rules in
// lib/discount.ts. See supabase/migration_102.sql for the schema and the
// row-locked RPC functions this module wraps.

import { supabaseAdmin } from "./supabase-admin";
import type { FulfillmentType } from "@/types/cart";

// ── Types ────────────────────────────────────────────────────────────────────

export type StoreCreditReason =
  | "goodwill_resolution"
  | "canceled_order"
  | "damaged_lost_package"
  | "return"
  | "price_adjustment"
  | "loyalty_vip"
  | "other";

export type StoreCreditStatus = "active" | "fully_used" | "expired" | "revoked";
export type StoreCreditUsageMode = "single_use" | "reusable_until_balance_zero";

export interface StoreCreditRow {
  id: string;
  code: string;
  customer_email: string;
  customer_id: string | null;
  source_order_id: string | null;
  currency: string;
  original_amount_cents: number;
  remaining_amount_cents: number;
  status: StoreCreditStatus;
  reason: StoreCreditReason;
  customer_message: string | null;
  internal_note: string | null;
  issued_at: string;
  issued_by: string;
  starts_at: string | null;
  expires_at: string | null;
  minimum_merchandise_subtotal_cents: number | null;
  maximum_line_items: number | null;
  eligible_fulfillment_types: FulfillmentType[] | null;
  eligible_product_ids: string[] | null;
  eligible_collection_ids: string[] | null;
  excluded_product_ids: string[] | null;
  exclude_sale_items: boolean;
  exclude_clearance_items: boolean;
  allow_with_discount_codes: boolean;
  allow_with_other_store_credits: boolean;
  usage_mode: StoreCreditUsageMode;
  maximum_credit_per_order_cents: number | null;
  maximum_credit_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface StoreCreditCartItem {
  productId: string;
  fulfillmentType: FulfillmentType;
}

export interface ValidateStoreCreditParams {
  code: string;
  email: string;
  merchandiseSubtotalCents: number; // post ordinary-discount, pre-shipping/insurance/tax — used only for minimum-purchase checks
  orderTotalCents: number;          // final order total before store credit (steps 1-6) — used for the eligible-amount cap and percentage cap
  items: StoreCreditCartItem[];
  discountCodeApplied: boolean;
  otherStoreCreditApplied: boolean;
  currency?: string;
}

export type ValidateStoreCreditResult =
  | {
      valid: true;
      storeCredit: StoreCreditRow;
      eligibleAmountCents: number;
      willForfeitRemainder: boolean;
    }
  | { valid: false; error: string };

// ── Code generation ────────────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L, matches generateSubscriberCouponCode

function randomCodeSegment(length: number): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const bytes: Buffer = crypto.randomBytes(length);
  let out = "";
  for (const byte of bytes) out += CODE_CHARS[byte % CODE_CHARS.length];
  return out;
}

export function generateStoreCreditCodeCandidate(): string {
  return `BBJ-SC-${randomCodeSegment(4)}-${randomCodeSegment(4)}`;
}

async function generateUniqueStoreCreditCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateStoreCreditCodeCandidate();
    const { data } = await supabaseAdmin
      .from("store_credits")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Failed to generate a unique store credit code after 10 attempts");
}

// ── Email normalization (matches lib/discount.ts normalizeEmail) ─────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Issuance ───────────────────────────────────────────────────────────────────

export interface IssueStoreCreditParams {
  amountCents: number;
  customerEmail: string;
  customerId?: string | null;
  sourceOrderId?: string | null;
  currency?: string;
  reason: StoreCreditReason;
  customerMessage?: string | null;
  internalNote?: string | null;
  issuedBy: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  minimumMerchandiseSubtotalCents?: number | null;
  maximumLineItems?: number | null;
  eligibleFulfillmentTypes?: FulfillmentType[] | null;
  eligibleProductIds?: string[] | null;
  eligibleCollectionIds?: string[] | null;
  excludedProductIds?: string[] | null;
  excludeSaleItems?: boolean;
  excludeClearanceItems?: boolean;
  allowWithDiscountCodes?: boolean;
  allowWithOtherStoreCredits?: boolean;
  usageMode?: StoreCreditUsageMode;
  maximumCreditPerOrderCents?: number | null;
  maximumCreditPercentage?: number | null;
}

/**
 * Issue a new store credit. Defaults match the ticket's recommended
 * defaults (§11): no expiration unless provided, non-transferable
 * (enforced structurally via email match at redemption, not a flag),
 * cannot be redeemed for cash (enforced structurally — it only ever
 * reduces a Stripe amount, never issues a refund), cannot combine with
 * another store credit, reusable until balance is zero, no product
 * restriction, no minimum purchase.
 */
export async function issueStoreCredit(params: IssueStoreCreditParams): Promise<StoreCreditRow> {
  if (params.amountCents <= 0) throw new Error("amountCents must be > 0");

  const code = await generateUniqueStoreCreditCode();
  const email = normalizeEmail(params.customerEmail);

  const { data: credit, error } = await supabaseAdmin
    .from("store_credits")
    .insert({
      code,
      customer_email: email,
      customer_id: params.customerId ?? null,
      source_order_id: params.sourceOrderId ?? null,
      currency: params.currency ?? "USD",
      original_amount_cents: params.amountCents,
      remaining_amount_cents: params.amountCents,
      status: "active",
      reason: params.reason,
      customer_message: params.customerMessage ?? null,
      internal_note: params.internalNote ?? null,
      issued_by: params.issuedBy,
      starts_at: params.startsAt ?? null,
      expires_at: params.expiresAt ?? null,
      minimum_merchandise_subtotal_cents: params.minimumMerchandiseSubtotalCents ?? null,
      maximum_line_items: params.maximumLineItems ?? null,
      eligible_fulfillment_types: params.eligibleFulfillmentTypes ?? null,
      eligible_product_ids: params.eligibleProductIds ?? null,
      eligible_collection_ids: params.eligibleCollectionIds ?? null,
      excluded_product_ids: params.excludedProductIds ?? null,
      exclude_sale_items: params.excludeSaleItems ?? false,
      exclude_clearance_items: params.excludeClearanceItems ?? false,
      allow_with_discount_codes: params.allowWithDiscountCodes ?? false,
      allow_with_other_store_credits: params.allowWithOtherStoreCredits ?? false,
      usage_mode: params.usageMode ?? "reusable_until_balance_zero",
      maximum_credit_per_order_cents: params.maximumCreditPerOrderCents ?? null,
      maximum_credit_percentage: params.maximumCreditPercentage ?? null,
    })
    .select("*")
    .single();

  if (error || !credit) throw new Error(`issueStoreCredit failed: ${error?.message}`);

  await supabaseAdmin.from("store_credit_transactions").insert({
    store_credit_id: credit.id,
    transaction_type: "issued",
    amount_cents: params.amountCents,
    balance_before_cents: 0,
    balance_after_cents: params.amountCents,
    created_by: params.issuedBy,
    reason: params.reason,
  });

  return credit as StoreCreditRow;
}

// ── Validation (read-only — never mutates balance) ────────────────────────────

export async function validateStoreCredit(
  params: ValidateStoreCreditParams
): Promise<ValidateStoreCreditResult> {
  const code = params.code.trim().toUpperCase();
  const email = normalizeEmail(params.email);

  if (!code) return { valid: false, error: "This store credit could not be found. Please check the code and try again." };
  if (params.merchandiseSubtotalCents <= 0) return { valid: false, error: "Cart is empty." };

  const { data: credit } = await supabaseAdmin
    .from("store_credits")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!credit) {
    return { valid: false, error: "This store credit could not be found. Please check the code and try again." };
  }
  const sc = credit as StoreCreditRow;

  if (sc.customer_email !== email) {
    return { valid: false, error: "This store credit is associated with a different email address." };
  }

  if (sc.status === "revoked") {
    return { valid: false, error: "This store credit could not be found. Please check the code and try again." };
  }
  if (sc.status === "fully_used" || sc.remaining_amount_cents <= 0) {
    return { valid: false, error: "This store credit has already been fully used." };
  }

  const now = Date.now();
  if (sc.starts_at && new Date(sc.starts_at).getTime() > now) {
    return { valid: false, error: "This store credit is not active yet." };
  }
  if (sc.expires_at && new Date(sc.expires_at).getTime() < now) {
    return {
      valid: false,
      error: `This store credit expired on ${formatDate(sc.expires_at)}.`,
    };
  }
  if (sc.status === "expired") {
    return {
      valid: false,
      error: sc.expires_at ? `This store credit expired on ${formatDate(sc.expires_at)}.` : "This store credit has expired.",
    };
  }

  if (params.currency && sc.currency !== params.currency) {
    return { valid: false, error: "This store credit could not be found. Please check the code and try again." };
  }

  if (
    sc.minimum_merchandise_subtotal_cents != null &&
    params.merchandiseSubtotalCents < sc.minimum_merchandise_subtotal_cents
  ) {
    return {
      valid: false,
      error: `This credit is valid on orders of $${(sc.minimum_merchandise_subtotal_cents / 100).toFixed(2)} or more.`,
    };
  }

  if (sc.maximum_line_items != null && params.items.length > sc.maximum_line_items) {
    return {
      valid: false,
      error:
        sc.maximum_line_items === 1
          ? "This credit can only be used on an order containing one item."
          : `This credit can only be used on an order containing ${sc.maximum_line_items} items or fewer.`,
    };
  }

  if (sc.eligible_fulfillment_types && sc.eligible_fulfillment_types.length > 0) {
    const allowed = new Set(sc.eligible_fulfillment_types);
    const hasIneligible = params.items.some((i) => !allowed.has(i.fulfillmentType));
    if (hasIneligible) {
      const label =
        allowed.size === 1 && allowed.has("available_now")
          ? "This credit is valid for Ship Now pieces only."
          : allowed.size === 1 && allowed.has("sourced_for_you")
            ? "This credit is valid for Sourced for You pieces only."
            : "This credit is valid for Ship Now and Sourced for You pieces.";
      return { valid: false, error: label };
    }
  }

  if (sc.eligible_product_ids && sc.eligible_product_ids.length > 0) {
    const allowed = new Set(sc.eligible_product_ids);
    const hasIneligible = params.items.some((i) => !allowed.has(i.productId));
    if (hasIneligible) {
      return { valid: false, error: "This credit is not valid on one or more items in your cart." };
    }
  }

  if (sc.excluded_product_ids && sc.excluded_product_ids.length > 0) {
    const excluded = new Set(sc.excluded_product_ids);
    const hasExcluded = params.items.some((i) => excluded.has(i.productId));
    if (hasExcluded) {
      return { valid: false, error: "This credit is not valid on one or more items in your cart." };
    }
  }

  if (sc.eligible_collection_ids && sc.eligible_collection_ids.length > 0) {
    const { data: collectionMembers } = await supabaseAdmin
      .from("collection_products")
      .select("product_id")
      .in("collection_id", sc.eligible_collection_ids)
      .in(
        "product_id",
        params.items.map((i) => i.productId)
      );
    const eligibleProductIds = new Set((collectionMembers ?? []).map((r) => r.product_id as string));
    const hasIneligible = params.items.some((i) => !eligibleProductIds.has(i.productId));
    if (hasIneligible) {
      return { valid: false, error: "This credit is not valid on one or more items in your cart." };
    }
  }

  if (sc.exclude_sale_items || sc.exclude_clearance_items) {
    const { data: productRows } = await supabaseAdmin
      .from("products")
      .select("id, status, is_clearance")
      .in(
        "id",
        params.items.map((i) => i.productId)
      );
    for (const p of productRows ?? []) {
      if (sc.exclude_sale_items && p.status === "on_sale") {
        return { valid: false, error: "This credit is not valid on sale items in your cart." };
      }
      if (sc.exclude_clearance_items && p.is_clearance) {
        return { valid: false, error: "This credit is not valid on clearance items in your cart." };
      }
    }
  }

  if (params.discountCodeApplied && !sc.allow_with_discount_codes) {
    return { valid: false, error: "This credit cannot be combined with the discount currently applied." };
  }

  if (params.otherStoreCreditApplied && !sc.allow_with_other_store_credits) {
    return { valid: false, error: "This credit cannot be combined with another store credit." };
  }

  // ── Compute the eligible amount for this order ────────────────────────────
  // Capped by the final order total (post shipping/insurance/tax, pre store
  // credit) — not the merchandise subtotal, which is only used for the
  // minimum-purchase condition above. Per-order dollar/percentage caps are
  // also against the order total (ticket example: "up to 25% of the order
  // total").
  let eligibleAmountCents = Math.min(sc.remaining_amount_cents, params.orderTotalCents);
  if (sc.maximum_credit_per_order_cents != null) {
    eligibleAmountCents = Math.min(eligibleAmountCents, sc.maximum_credit_per_order_cents);
  }
  if (sc.maximum_credit_percentage != null) {
    const capCents = Math.floor((params.orderTotalCents * sc.maximum_credit_percentage) / 100);
    eligibleAmountCents = Math.min(eligibleAmountCents, capCents);
  }

  if (eligibleAmountCents <= 0) {
    return { valid: false, error: "This store credit could not be applied to this order." };
  }

  const willForfeitRemainder = sc.usage_mode === "single_use" && eligibleAmountCents < sc.remaining_amount_cents;

  return { valid: true, storeCredit: sc, eligibleAmountCents, willForfeitRemainder };
}

// ── Reservation / redemption / restoration wrappers ───────────────────────────
// Concurrency-critical section — see reserve_store_credit is currently
// reserved by another checkout error message in the ticket's §10.

export async function reserveStoreCredit(params: {
  storeCreditId: string;
  amountCents: number;
  checkoutReference: string;
}): Promise<{ reserved: true; transactionId: string } | { reserved: false }> {
  const { data, error } = await supabaseAdmin.rpc("reserve_store_credit", {
    p_store_credit_id: params.storeCreditId,
    p_amount_cents: params.amountCents,
    p_checkout_reference: params.checkoutReference,
    p_created_by: "checkout",
  });
  if (error || !data) return { reserved: false };
  return { reserved: true, transactionId: data as string };
}

export async function releaseStoreCreditReservation(checkoutReference: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("release_store_credit_reservation", {
    p_checkout_reference: checkoutReference,
  });
  if (error) {
    console.error("[store-credit] releaseStoreCreditReservation failed (non-fatal):", error);
    return false;
  }
  return !!data;
}

export async function redeemStoreCreditReservation(checkoutReference: string, orderId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("redeem_store_credit_reservation", {
    p_checkout_reference: checkoutReference,
    p_order_id: orderId,
  });
  if (error) {
    console.error("[store-credit] redeemStoreCreditReservation failed:", error);
    return false;
  }
  return !!data;
}

export async function restoreStoreCredit(params: {
  storeCreditId: string;
  amountCents: number;
  orderId: string;
  reason?: string;
  createdBy?: string;
}): Promise<boolean> {
  if (params.amountCents <= 0) return true; // nothing to restore
  const { data, error } = await supabaseAdmin.rpc("restore_store_credit", {
    p_store_credit_id: params.storeCreditId,
    p_amount_cents: params.amountCents,
    p_order_id: params.orderId,
    p_reason: params.reason ?? null,
    p_created_by: params.createdBy ?? "system",
  });
  if (error) {
    console.error("[store-credit] restoreStoreCredit failed:", error);
    return false;
  }
  return !!data;
}

export async function adjustStoreCreditBalance(params: {
  storeCreditId: string;
  deltaCents: number;
  reason: string;
  createdBy: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("adjust_store_credit_balance", {
    p_store_credit_id: params.storeCreditId,
    p_delta_cents: params.deltaCents,
    p_reason: params.reason,
    p_created_by: params.createdBy,
  });
  if (error) {
    console.error("[store-credit] adjustStoreCreditBalance failed:", error);
    return false;
  }
  return !!data;
}

// ── Shared display-conditions formatter ────────────────────────────────────────
// Single source of truth for customer-facing wording, used by: admin issuance
// preview, the customer email, checkout display, and the admin detail page.
// Only ever includes a line when the underlying condition actually applies —
// never renders a false/empty/technical condition.

export function getStoreCreditDisplayConditions(sc: StoreCreditRow): string[] {
  const lines: string[] = [];

  if (sc.expires_at) {
    lines.push(`Expires on ${formatDate(sc.expires_at)}.`);
  }
  if (sc.starts_at && new Date(sc.starts_at).getTime() > Date.now()) {
    lines.push(`Valid starting ${formatDate(sc.starts_at)}.`);
  }
  if (sc.minimum_merchandise_subtotal_cents != null) {
    lines.push(
      `Valid on merchandise purchases of $${(sc.minimum_merchandise_subtotal_cents / 100).toFixed(2)} or more.`
    );
  }
  if (sc.maximum_line_items != null) {
    lines.push(
      sc.maximum_line_items === 1
        ? "May be applied to an order containing one merchandise item only."
        : `May be applied to an order containing up to ${sc.maximum_line_items} merchandise items.`
    );
  }
  if (sc.eligible_fulfillment_types && sc.eligible_fulfillment_types.length > 0) {
    const set = new Set(sc.eligible_fulfillment_types);
    if (set.size === 1 && set.has("available_now")) lines.push("Valid for Ship Now pieces only.");
    else if (set.size === 1 && set.has("sourced_for_you")) lines.push("Valid for Sourced for You pieces only.");
    else lines.push("Valid for Ship Now and Sourced for You pieces.");
  }
  if (sc.eligible_product_ids && sc.eligible_product_ids.length > 0) {
    lines.push("Valid on select items only.");
  }
  if (sc.eligible_collection_ids && sc.eligible_collection_ids.length > 0) {
    lines.push("Valid on a select collection only.");
  }
  if (sc.excluded_product_ids && sc.excluded_product_ids.length > 0) {
    lines.push("Not valid on certain excluded items.");
  }
  if (sc.exclude_sale_items) lines.push("Not valid on sale items.");
  if (sc.exclude_clearance_items) lines.push("Not valid on clearance items.");
  if (!sc.allow_with_discount_codes) lines.push("Cannot be combined with another discount code.");
  if (!sc.allow_with_other_store_credits) lines.push("Cannot be combined with another store credit.");

  if (sc.usage_mode === "single_use") {
    lines.push("This credit may be used once. Any unused amount will be forfeited after redemption.");
  } else {
    lines.push("Any unused balance will remain available until the credit expires.");
  }

  if (sc.maximum_credit_per_order_cents != null) {
    lines.push(`A maximum of $${(sc.maximum_credit_per_order_cents / 100).toFixed(2)} may be applied per order.`);
  }
  if (sc.maximum_credit_percentage != null) {
    lines.push(`The credit may cover up to ${sc.maximum_credit_percentage}% of the order total.`);
  }

  lines.push(`This credit is associated with ${sc.customer_email} and is non-transferable.`);

  return lines;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
