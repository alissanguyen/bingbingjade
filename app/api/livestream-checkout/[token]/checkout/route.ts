import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { ALLOWED_COUNTRIES } from "@/lib/shipping";
import { calculateLivestreamPricing } from "@/lib/livestream-pricing";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: { country?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { country = "US", state = "" } = body;
  const countryCode = country.trim().toUpperCase();

  if (!ALLOWED_COUNTRIES.find((c) => c.code === countryCode))
    return NextResponse.json({ error: `Unsupported country: ${countryCode}` }, { status: 400 });

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("id, status, checkout_active, checkout_expires_at, checkout_session_id, title_snapshot, size, price, checkout_price, buyer_handle, buyer_platform")
    .eq("checkout_token", token)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Invalid checkout link" }, { status: 404 });

  if (!item.checkout_active || item.status !== "checkout_sent")
    return NextResponse.json({ error: "This checkout is no longer active" }, { status: 409 });

  if (item.checkout_expires_at && new Date(item.checkout_expires_at) < new Date())
    return NextResponse.json({ error: "This checkout link has expired" }, { status: 410 });

  // Expire any previous Stripe session (buyer changing country/state)
  if (item.checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(item.checkout_session_id);
    } catch {
      // Already expired or invalid — ignore
    }
  }

  const finalPrice = item.checkout_price ?? item.price;
  const pricing = calculateLivestreamPricing(finalPrice, countryCode, state);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: item.title_snapshot,
          ...(item.size ? { description: `Size: ${item.size}` } : {}),
        },
        unit_amount: Math.round(finalPrice * 100),
      },
      quantity: 1,
    },
  ];

  if (pricing.shipping > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: Math.round(pricing.shipping * 100),
      },
      quantity: 1,
    });
  }

  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: "Transaction Fee (5%)" },
      unit_amount: Math.round(pricing.txFee * 100),
    },
    quantity: 1,
  });

  if (pricing.tax > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "WA Sales Tax (10.5%)" },
        unit_amount: Math.round(pricing.tax * 100),
      },
      quantity: 1,
    });
  }

  // Stripe requires expires_at >= 30 min from now; cap at item's own expiry
  const itemExpiryTs = item.checkout_expires_at
    ? Math.floor(new Date(item.checkout_expires_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const minExpiryTs = Math.floor(Date.now() / 1000) + 30 * 60;
  const stripeExpiresAt = Math.max(itemExpiryTs, minExpiryTs);

  // Authorize only — the buyer has a 24-hour change-of-mind window, and Stripe
  // keeps its processing fee on refunds. Admin captures from the order page
  // once the window passes, or releases the hold at no cost if they cancel.
  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_intent_data: { capture_method: "manual" },
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: ALLOWED_COUNTRIES.map((c) => c.code) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/livestream-checkout/${token}`,
    expires_at: stripeExpiresAt,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    metadata: {
      is_livestream_checkout: "true",
      capture_mode: "manual",
      livestream_item_id: item.id,
      buyer_handle: item.buyer_handle ?? "",
      buyer_platform: item.buyer_platform ?? "instagram",
      buyer_country: countryCode,
      buyer_state: state.trim().toUpperCase(),
    },
  });

  await supabaseAdmin
    .from("livestream_items")
    .update({
      checkout_url: stripeSession.url,
      checkout_session_id: stripeSession.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await supabaseAdmin.from("livestream_item_events").insert({
    livestream_item_id: item.id,
    event_type: "checkout_started",
    message: `Buyer started checkout — $${pricing.total.toFixed(2)} total (item $${finalPrice.toFixed(2)}, shipping $${pricing.shipping.toFixed(2)}, fee $${pricing.txFee.toFixed(2)}${pricing.isWA ? `, WA tax $${pricing.tax.toFixed(2)}` : ""}) · ${countryCode}${state ? `/${state.toUpperCase()}` : ""}`,
    buyer_handle: item.buyer_handle ?? null,
    metadata: {
      checkout_session_id: stripeSession.id,
      checkout_price: finalPrice,
      shipping: pricing.shipping,
      tx_fee: pricing.txFee,
      tax: pricing.tax,
      total: pricing.total,
      country: countryCode,
      state: state.trim().toUpperCase(),
    },
    created_by: "buyer",
  });

  return NextResponse.json({ url: stripeSession.url });
}
