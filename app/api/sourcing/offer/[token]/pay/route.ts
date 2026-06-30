import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { ALLOWED_COUNTRIES, getShippingZone, calculateShipping, calculateStripeFee, calculateBnplFee, ACTIVE_BNPL_METHODS } from "@/lib/shipping";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

// POST /api/sourcing/offer/[token]/pay
// Body: { shippingAddress, paymentMethod, taxAmountCents?, taxCalculationId? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: offer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, public_token, status, expires_at, title_snapshot, images_snapshot_json, price_cents, sourcing_credit_applied_cents, customer_email, sourcing_request_id, sourcing_attempt_id, sourcing_attempt_option_id")
    .eq("public_token", token)
    .maybeSingle();

  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  if (offer.status !== "pending_checkout") {
    return NextResponse.json({ error: "This offer is no longer available." }, { status: 400 });
  }
  if (offer.expires_at && new Date(offer.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "This offer has expired." }, { status: 400 });
  }

  let body: { shippingAddress?: Record<string, string>; paymentMethod?: string; taxAmountCents?: number; taxCalculationId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const addr = body.shippingAddress;
  const allowedCountryCodes = new Set(ALLOWED_COUNTRIES.map((c) => c.code));
  if (!addr || !addr.name || !addr.line1 || !addr.postal || !addr.country) {
    return NextResponse.json({ error: "Shipping address is required." }, { status: 400 });
  }
  if (!allowedCountryCodes.has(addr.country)) {
    return NextResponse.json({ error: "Shipping to that country is not supported." }, { status: 400 });
  }

  const paymentMethod = body.paymentMethod === "bnpl" ? "bnpl" : "standard";
  if (paymentMethod === "bnpl" && addr.country !== "US") {
    return NextResponse.json({ error: "Installment payments are only available for US shipping addresses." }, { status: 400 });
  }

  // Compute real pricing from zone
  const zone = getShippingZone(addr.country);
  const shippingCents = calculateShipping(zone, 1) * 100;
  const priceCents = offer.price_cents as number;
  const creditCents = (offer.sourcing_credit_applied_cents as number) ?? 0;

  // WA state tax from client-side pre-calculation
  const taxAmountCents = typeof body.taxAmountCents === "number" && body.taxAmountCents > 0
    ? body.taxAmountCents
    : 0;

  // Credit is capped to item + actual shipping
  const effectiveCredit = Math.min(creditCents, priceCents + shippingCents);
  const afterCreditCents = Math.max(0, priceCents + shippingCents - effectiveCredit);
  // Tx fee computed on (after-credit + tax), same as public checkout
  const txFeeCents = paymentMethod === "bnpl"
    ? calculateBnplFee(afterCreditCents + taxAmountCents)
    : calculateStripeFee(afterCreditCents + taxAmountCents, zone);

  // Fetch sourcing request token for success/cancel URLs
  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("public_token")
    .eq("id", offer.sourcing_request_id)
    .maybeSingle();
  const sourcingToken = sourcingReq?.public_token ?? "";

  // Build Stripe line items
  const lineItems: {
    price_data: {
      currency: string;
      product_data: { name: string; images?: string[] };
      unit_amount: number;
      tax_behavior: "exclusive";
    };
    quantity: number;
  }[] = [];

  const images = (offer.images_snapshot_json ?? []) as string[];
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: {
        name: offer.title_snapshot as string,
        ...(images.length > 0 ? { images: [images[0]] } : {}),
      },
      unit_amount: priceCents,
      tax_behavior: "exclusive",
    },
    quantity: 1,
  });

  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: "Shipping" },
      unit_amount: shippingCents,
      tax_behavior: "exclusive",
    },
    quantity: 1,
  });

  if (taxAmountCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Washington State Sales Tax" },
        unit_amount: taxAmountCents,
        tax_behavior: "exclusive",
      },
      quantity: 1,
    });
  }

  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: paymentMethod === "bnpl" ? "Installment Fee" : "Transaction Fee" },
      unit_amount: txFeeCents,
      tax_behavior: "exclusive",
    },
    quantity: 1,
  });

  // Apply sourcing credit as a Stripe coupon (no negative line items)
  let stripeCouponId: string | null = null;
  if (effectiveCredit > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: effectiveCredit,
      currency: "usd",
      duration: "once",
      name: "Sourcing Deposit Credit",
    });
    stripeCouponId = coupon.id;
  }

  // Metadata for webhook
  const addrMeta: Record<string, string> = {
    ship_name: addr.name,
    ship_line1: addr.line1,
    ship_city: addr.city,
    ship_postal: addr.postal,
    ship_country: addr.country,
    ...(addr.line2 ? { ship_line2: addr.line2 } : {}),
    ...(addr.state ? { ship_state: addr.state } : {}),
  };

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "usd",
      payment_method_types: paymentMethod === "bnpl" ? ACTIVE_BNPL_METHODS : ["card"],
      line_items: lineItems,
      customer_email: offer.customer_email as string,
      success_url: `${SITE_URL}/custom-sourcing/${sourcingToken}?purchased=1`,
      cancel_url: `${SITE_URL}/checkout/custom-sourcing/${token}`,
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        terms_of_service_acceptance: {
          message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
        },
      },
      ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
      metadata: {
        type: "sourcing_checkout",
        sourcing_checkout_offer_id: offer.id as string,
        sourcing_request_id: offer.sourcing_request_id as string,
        sourcing_attempt_option_id: offer.sourcing_attempt_option_id as string,
        payment_method: paymentMethod,
        sourcing_credit_applied_cents: String(effectiveCredit),
        ...(body.taxCalculationId ? { tax_calculation_id: body.taxCalculationId } : {}),
        ...addrMeta,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sourcing/pay] Stripe session creation failed:", message);
    if (message.includes("payment_method_types") || message.includes("not supported")) {
      return NextResponse.json(
        { error: "Installment payments are not available in your region. Please use Standard payment." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `Payment error: ${message}` }, { status: 500 });
  }

  // Store session ID on offer
  await supabaseAdmin
    .from("sourcing_checkout_offers")
    .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("id", offer.id);

  return NextResponse.json({ url: session.url });
}
