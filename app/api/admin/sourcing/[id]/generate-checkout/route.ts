import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const SHIPPING_CENTS = 2000;       // $20 flat for sourced items
const TX_FEE_RATE   = 0.035;
const CHECKOUT_WINDOW_HOURS = 24;  // Stripe max for Payment mode

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { itemName?: string; priceCents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { itemName, priceCents } = body;
  if (!itemName || typeof itemName !== "string" || !itemName.trim())
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  if (!priceCents || typeof priceCents !== "number" || priceCents <= 0 || !Number.isInteger(priceCents))
    return NextResponse.json({ error: "Price must be a positive whole number of cents." }, { status: 400 });

  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, customer_email, payment_status, sourcing_status, deposit_amount_cents, credit_expires_at, private_checkout_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!sourcingReq)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (sourcingReq.payment_status !== "paid")
    return NextResponse.json({ error: "Deposit not yet paid." }, { status: 400 });

  // Reject if already fulfilled
  if (sourcingReq.sourcing_status === "fulfilled")
    return NextResponse.json({ error: "This request is already fulfilled." }, { status: 400 });

  // Reject if there's still an active (non-expired) private checkout
  if (sourcingReq.private_checkout_session_id) {
    try {
      const prev = await stripe.checkout.sessions.retrieve(sourcingReq.private_checkout_session_id as string);
      if (prev.status === "open") {
        return NextResponse.json({ error: "An active checkout link already exists. Expire it first or wait for it to expire." }, { status: 409 });
      }
    } catch {
      // Session no longer exists — safe to proceed
    }
  }

  // Credit validity
  if (sourcingReq.credit_expires_at && new Date(sourcingReq.credit_expires_at as string) < new Date()) {
    return NextResponse.json({ error: "This sourcing credit has expired." }, { status: 400 });
  }

  // Compute available credit
  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", id);

  const availableCredit = computeAvailableCredit(
    sourcingReq.deposit_amount_cents as number,
    (ledger ?? []) as LedgerRow[]
  );

  if (availableCredit <= 0)
    return NextResponse.json({ error: "No remaining credit on this request." }, { status: 400 });

  // Build line items
  const txFeeCents = Math.round((priceCents + SHIPPING_CENTS) * TX_FEE_RATE);
  const totalBeforeCredit = priceCents + SHIPPING_CENTS + txFeeCents;
  const creditApplied = Math.min(availableCredit, totalBeforeCredit);

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: itemName.trim() },
        unit_amount: priceCents,
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: SHIPPING_CENTS,
      },
      quantity: 1,
    },
    {
      price_data: {
        currency: "usd",
        product_data: { name: "Transaction Fee (3.5%)" },
        unit_amount: txFeeCents,
      },
      quantity: 1,
    },
  ];

  // Create Stripe coupon for the sourcing credit
  let stripeCouponId: string | null = null;
  if (creditApplied > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: creditApplied,
      currency: "usd",
      duration: "once",
      name: "Sourcing Credit",
    });
    stripeCouponId = coupon.id;
  }

  const now = new Date();
  const expiresAt = Math.floor((now.getTime() + CHECKOUT_WINDOW_HOURS * 60 * 60 * 1000) / 1000);

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: [
        "US", "CA", "GB", "AU", "NZ",
        "SG", "MY", "HK", "TW", "JP", "KR", "TH", "VN", "PH", "ID", "IN",
        "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI",
        "CN",
      ],
    },
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${SITE_URL}/custom-sourcing`,
    expires_at:  expiresAt,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
    metadata: {
      is_sourcing_private_checkout:      "true",
      sourcing_request_id:               id,
      sourcing_credit_applied_cents:     String(creditApplied),
      item_name:                         itemName.trim(),
      item_price_cents:                  String(priceCents),
    },
  });

  // Store private checkout details on the request
  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      sourcing_status:               "accepted_pending_checkout",
      private_checkout_session_id:   stripeSession.id,
      private_checkout_url:          stripeSession.url,
      private_checkout_amount_cents: totalBeforeCredit - creditApplied,
      accepted_checkout_expires_at:  new Date(expiresAt * 1000).toISOString(),
      updated_at:                    now.toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    url:              stripeSession.url,
    expiresAt:        new Date(expiresAt * 1000).toISOString(),
    creditApplied,
    totalBeforeCredit,
  });
}
