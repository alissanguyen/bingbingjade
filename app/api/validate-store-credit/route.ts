/**
 * Validate a store-credit code for checkout display purposes.
 *
 * This endpoint is READ-ONLY — it never writes to the database and never
 * reserves any balance. The actual reservation and redemption happen
 * server-side inside /api/stripe/checkout, which re-validates everything
 * from scratch and never trusts amounts echoed back from the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateStoreCredit, getStoreCreditDisplayConditions, normalizeEmail } from "@/lib/store-credit";
import type { FulfillmentType } from "@/types/cart";

export async function POST(req: NextRequest) {
  let body: {
    code?: string;
    customerEmail?: string;
    merchandiseSubtotalCents?: number;
    orderTotalCents?: number;
    items?: { productId: string; fulfillmentType: FulfillmentType }[];
    discountCodeApplied?: boolean;
    otherStoreCreditApplied?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { code, customerEmail, merchandiseSubtotalCents, orderTotalCents, items } = body;

  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: "This store credit could not be found. Please check the code and try again." });
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(customerEmail))) {
    return NextResponse.json({ valid: false, error: "Enter your email before applying a store credit code." });
  }
  if (typeof merchandiseSubtotalCents !== "number" || merchandiseSubtotalCents <= 0) {
    return NextResponse.json({ valid: false, error: "Cart is empty." });
  }
  if (typeof orderTotalCents !== "number" || orderTotalCents < 0) {
    return NextResponse.json({ error: "Invalid cart total." }, { status: 400 });
  }

  const result = await validateStoreCredit({
    code,
    email: customerEmail,
    merchandiseSubtotalCents,
    orderTotalCents,
    items: items ?? [],
    discountCodeApplied: !!body.discountCodeApplied,
    otherStoreCreditApplied: !!body.otherStoreCreditApplied,
  });

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error });
  }

  return NextResponse.json({
    valid: true,
    codeMasked: maskCode(result.storeCredit.code),
    availableBalanceCents: result.storeCredit.remaining_amount_cents,
    eligibleAmountCents: result.eligibleAmountCents,
    remainingAfterCents: result.storeCredit.remaining_amount_cents - result.eligibleAmountCents,
    willForfeitRemainder: result.willForfeitRemainder,
    conditions: getStoreCreditDisplayConditions(result.storeCredit),
  });
}

function maskCode(code: string): string {
  // BBJ-SC-AB12-CD34 -> BBJ-SC-••••-CD34
  const parts = code.split("-");
  if (parts.length < 4) return code;
  return [...parts.slice(0, 2), "••••", parts[3]].join("-");
}
