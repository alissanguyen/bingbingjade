import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const SHIPPING_CENTS = 2000;
const TX_FEE_RATE = 0.035;
const CHECKOUT_WINDOW_HOURS = 24;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, customer_email, payment_status, sourcing_status, deposit_amount_cents, credit_expires_at, private_checkout_session_id, private_checkout_amount_cents")
    .eq("id", id)
    .maybeSingle();

  if (!sourcingReq) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (sourcingReq.payment_status !== "paid")
    return NextResponse.json({ error: "Deposit not paid." }, { status: 400 });
  if (sourcingReq.sourcing_status === "fulfilled")
    return NextResponse.json({ error: "Already fulfilled." }, { status: 400 });
  if (!sourcingReq.private_checkout_session_id)
    return NextResponse.json({ error: "No previous checkout to regenerate. Use generate-checkout instead." }, { status: 400 });

  // Credit must still be valid
  if (sourcingReq.credit_expires_at && new Date(sourcingReq.credit_expires_at as string) < new Date()) {
    return NextResponse.json({ error: "Credit has expired — cannot regenerate checkout." }, { status: 400 });
  }

  // Retrieve previous session to get item details from metadata
  let prevMeta: Record<string, string> = {};
  try {
    const prev = await stripe.checkout.sessions.retrieve(sourcingReq.private_checkout_session_id as string);
    if (prev.status === "complete") {
      return NextResponse.json({ error: "Previous checkout was already paid." }, { status: 400 });
    }
    if (prev.metadata) prevMeta = prev.metadata as Record<string, string>;
  } catch {
    // session may be expired/deleted, proceed with regenerate
  }

  const itemName = prevMeta.item_name;
  const priceCents = parseInt(prevMeta.item_price_cents ?? "0", 10);

  if (!itemName || !priceCents) {
    return NextResponse.json({ error: "Cannot recover previous item details. Use generate-checkout instead." }, { status: 400 });
  }

  // Compute available credit
  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", id);

  const available = computeAvailableCredit(
    sourcingReq.deposit_amount_cents as number,
    (ledger ?? []) as LedgerRow[]
  );

  if (available <= 0)
    return NextResponse.json({ error: "No remaining credit." }, { status: 400 });

  const txFeeCents = Math.round((priceCents + SHIPPING_CENTS) * TX_FEE_RATE);
  const totalBeforeCredit = priceCents + SHIPPING_CENTS + txFeeCents;
  const creditApplied = Math.min(available, totalBeforeCredit);

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
    line_items: [
      {
        price_data: { currency: "usd", product_data: { name: itemName }, unit_amount: priceCents },
        quantity: 1,
      },
      {
        price_data: { currency: "usd", product_data: { name: "Shipping" }, unit_amount: SHIPPING_CENTS },
        quantity: 1,
      },
      {
        price_data: { currency: "usd", product_data: { name: "Transaction Fee (3.5%)" }, unit_amount: txFeeCents },
        quantity: 1,
      },
    ],
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
      is_sourcing_private_checkout:  "true",
      sourcing_request_id:           id,
      sourcing_credit_applied_cents: String(creditApplied),
      item_name:                     itemName,
      item_price_cents:              String(priceCents),
    },
  });

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
    url:       stripeSession.url,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    creditApplied,
  });
}
