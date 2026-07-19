import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { getStoreCreditDisplayConditions, generateStoreCreditCodeCandidate, normalizeEmail } from "@/lib/store-credit";
import { buildStoreCreditEmailHtml } from "@/lib/discount-emails";
import type { StoreCreditReason, StoreCreditUsageMode, StoreCreditRow } from "@/lib/store-credit";
import type { FulfillmentType } from "@/types/cart";

/**
 * Preview the store-credit email from in-progress issuance-form fields —
 * nothing is persisted. Uses the same buildStoreCreditEmailHtml() /
 * getStoreCreditDisplayConditions() the real issuance and resend flows use,
 * so what's previewed here always matches what actually gets sent.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    amountCents?: number;
    customerEmail?: string;
    customerName?: string | null;
    sourceOrderNumber?: string | null;
    reason?: StoreCreditReason;
    customerMessage?: string | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    minimumMerchandiseSubtotalCents?: number | null;
    maximumLineItems?: number | null;
    eligibleFulfillmentTypes?: FulfillmentType[] | null;
    excludeSaleItems?: boolean;
    excludeClearanceItems?: boolean;
    allowWithDiscountCodes?: boolean;
    allowWithOtherStoreCredits?: boolean;
    usageMode?: StoreCreditUsageMode;
    maximumCreditPerOrderCents?: number | null;
    maximumCreditPercentage?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amountCents = body.amountCents && body.amountCents > 0 ? body.amountCents : 100;
  const email = body.customerEmail?.trim() ? normalizeEmail(body.customerEmail) : "customer@example.com";
  const now = new Date().toISOString();

  const draft: StoreCreditRow = {
    id: "preview",
    code: generateStoreCreditCodeCandidate(),
    customer_email: email,
    customer_id: null,
    source_order_id: null,
    currency: "USD",
    original_amount_cents: amountCents,
    remaining_amount_cents: amountCents,
    status: "active",
    reason: body.reason ?? "goodwill_resolution",
    customer_message: body.customerMessage ?? null,
    internal_note: null,
    issued_at: now,
    issued_by: "admin",
    starts_at: body.startsAt ?? null,
    expires_at: body.expiresAt ?? null,
    minimum_merchandise_subtotal_cents: body.minimumMerchandiseSubtotalCents ?? null,
    maximum_line_items: body.maximumLineItems ?? null,
    eligible_fulfillment_types: body.eligibleFulfillmentTypes ?? null,
    eligible_product_ids: null,
    eligible_collection_ids: null,
    excluded_product_ids: null,
    exclude_sale_items: body.excludeSaleItems ?? false,
    exclude_clearance_items: body.excludeClearanceItems ?? false,
    allow_with_discount_codes: body.allowWithDiscountCodes ?? false,
    allow_with_other_store_credits: body.allowWithOtherStoreCredits ?? false,
    usage_mode: body.usageMode ?? "reusable_until_balance_zero",
    maximum_credit_per_order_cents: body.maximumCreditPerOrderCents ?? null,
    maximum_credit_percentage: body.maximumCreditPercentage ?? null,
    created_at: now,
    updated_at: now,
  };

  const { html, subject } = buildStoreCreditEmailHtml({
    storeCredit: draft,
    customerName: body.customerName ?? null,
    sourceOrderNumber: body.sourceOrderNumber ?? null,
    conditions: getStoreCreditDisplayConditions(draft),
    isResend: false,
  });

  return NextResponse.json({ html, subject });
}
