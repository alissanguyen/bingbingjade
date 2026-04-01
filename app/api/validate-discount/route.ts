/**
 * Validate a discount code or check for automatic discounts (welcome, store credit).
 *
 * This endpoint is READ-ONLY — it never writes to the database.
 * All actual commitment of discounts happens in the Stripe webhook after payment.
 *
 * The discount amount returned here is re-validated server-side at checkout time,
 * so the client cannot manipulate discount values.
 *
 * NOTE: This endpoint should be rate-limited in production (e.g. via middleware
 * or an edge function) to prevent email enumeration. Currently relies on Stripe
 * checkout as the enforced gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateDiscount, normalizeEmail } from "@/lib/discount";

export async function POST(req: NextRequest) {
  let body: {
    customerEmail?: string;
    discountCode?: string;
    subtotalCents?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { customerEmail, discountCode, subtotalCents } = body;

  if (typeof subtotalCents !== "number" || subtotalCents <= 0) {
    return NextResponse.json({ error: "Invalid cart total." }, { status: 400 });
  }

  let email: string | null = null;
  if (customerEmail) {
    email = normalizeEmail(customerEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
  }

  if (!email && !discountCode) {
    return NextResponse.json({ error: "A discount code is required." }, { status: 400 });
  }

  const result = await validateDiscount({
    customerEmail: email,
    discountCode: discountCode ?? null,
    subtotalCents,
  });

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    source: result.source,
    discountAmountCents: result.discountAmountCents,
    displayMessage: result.displayMessage,
  });
}
