import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";
import { ALLOWED_COUNTRIES } from "@/lib/shipping";
import { calculateLivestreamPricing } from "@/lib/livestream-pricing";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const CHECKOUT_WINDOW_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  let body: {
    buyer_handle?: string;
    buyer_platform?: string;
    checkout_price?: number;
    price_override_note?: string;
    country?: string;
    state?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    buyer_handle,
    buyer_platform = "instagram",
    checkout_price,
    price_override_note,
    country = "US",
    state = "",
  } = body;

  if (!buyer_handle?.trim())
    return NextResponse.json({ error: "buyer_handle is required" }, { status: 400 });

  const countryCode = country.trim().toUpperCase();
  if (!ALLOWED_COUNTRIES.find((c) => c.code === countryCode))
    return NextResponse.json({ error: `Unsupported country: ${countryCode}` }, { status: 400 });

  // Fetch item
  const { data: item, error: itemErr } = await supabaseAdmin
    .from("livestream_items")
    .select("*, livestream:livestreams(title, code_prefix)")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (item.status !== "available")
    return NextResponse.json({ error: `Item is already ${item.status}` }, { status: 409 });

  const finalPrice = checkout_price ?? item.price;
  if (!finalPrice || finalPrice <= 0)
    return NextResponse.json({ error: "checkout_price must be > 0" }, { status: 400 });

  if (item.minimum_price && finalPrice < item.minimum_price)
    return NextResponse.json(
      { error: `Price $${finalPrice} is below minimum $${item.minimum_price}` },
      { status: 400 }
    );

  // Calculate shipping, transaction fee, and WA sales tax
  const pricing = calculateLivestreamPricing(finalPrice, countryCode, state);

  // Build Stripe line items
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

  if (pricing.txFee > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Transaction Fee (5%)" },
        unit_amount: Math.round(pricing.txFee * 100),
      },
      quantity: 1,
    });
  }

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

  // Create Stripe checkout session
  const now = new Date();
  const expiresAt = Math.floor((now.getTime() + CHECKOUT_WINDOW_HOURS * 60 * 60 * 1000) / 1000);

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: ALLOWED_COUNTRIES.map((c) => c.code) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}`,
    expires_at: expiresAt,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    metadata: {
      is_livestream_checkout: "true",
      livestream_item_id: itemId,
      buyer_handle: buyer_handle.trim(),
      buyer_platform,
      buyer_country: countryCode,
      buyer_state: state.trim().toUpperCase(),
    },
  });

  const expiresAtIso = new Date(expiresAt * 1000).toISOString();

  // Update item
  await supabaseAdmin
    .from("livestream_items")
    .update({
      status: "checkout_sent",
      buyer_handle: buyer_handle.trim(),
      buyer_platform,
      checkout_price: finalPrice,
      price_override_note: price_override_note ?? null,
      checkout_url: stripeSession.url,
      checkout_session_id: stripeSession.id,
      checkout_expires_at: expiresAtIso,
      checkout_active: true,
      updated_at: now.toISOString(),
    })
    .eq("id", itemId);

  // Reserve linked product
  if (item.product_id) {
    await supabaseAdmin
      .from("products")
      .update({
        status: "reserved",
        reserved_until: expiresAtIso,
        reserved_for_handle: buyer_handle.trim(),
        reserved_livestream_item_id: itemId,
      })
      .eq("id", item.product_id);
  }

  // Log event
  await supabaseAdmin.from("livestream_item_events").insert({
    livestream_item_id: itemId,
    event_type: "checkout_sent",
    message: `Checkout sent to @${buyer_handle.trim()} — total $${pricing.total.toFixed(2)} (item $${finalPrice.toFixed(2)}, shipping $${pricing.shipping.toFixed(2)}, fee $${pricing.txFee.toFixed(2)}${pricing.isWA ? `, WA tax $${pricing.tax.toFixed(2)}` : ""})`,
    buyer_handle: buyer_handle.trim(),
    metadata: {
      checkout_session_id: stripeSession.id,
      checkout_price: finalPrice,
      shipping: pricing.shipping,
      tx_fee: pricing.txFee,
      tax: pricing.tax,
      total: pricing.total,
      country: countryCode,
      state: state.trim().toUpperCase(),
      expires_at: expiresAtIso,
    },
    created_by: "admin",
  });

  // Build DM message with full total
  const tokenUrl = `${SITE_URL}/livestream-checkout/${item.checkout_token}`;
  const dmMessage = buildDMMessage({
    buyerHandle: buyer_handle.trim(),
    itemCode: item.code,
    itemTitle: item.title_snapshot,
    size: item.size,
    itemPrice: finalPrice,
    shipping: pricing.shipping,
    txFee: pricing.txFee,
    tax: pricing.tax,
    total: pricing.total,
    isWA: pricing.isWA,
    checkoutUrl: tokenUrl,
    expiresAt: expiresAtIso,
  });

  return NextResponse.json({
    ok: true,
    checkoutUrl: stripeSession.url,
    tokenUrl,
    expiresAt: expiresAtIso,
    pricing,
    dmMessage,
  });
}

function buildDMMessage({
  buyerHandle, itemCode, itemTitle, size,
  itemPrice, shipping, txFee, tax, total, isWA,
  checkoutUrl, expiresAt,
}: {
  buyerHandle: string;
  itemCode: string;
  itemTitle: string;
  size: string | null;
  itemPrice: number;
  shipping: number;
  txFee: number;
  tax: number;
  total: number;
  isWA: boolean;
  checkoutUrl: string;
  expiresAt: string;
}) {
  const expireStr = new Date(expiresAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  const breakdown = [
    `  Item: $${itemPrice.toFixed(2)}`,
    shipping > 0 ? `  Shipping: $${shipping.toFixed(2)}` : `  Shipping: Free`,
    `  Transaction fee: $${txFee.toFixed(2)}`,
    ...(isWA ? [`  WA Sales Tax (10.5%): $${tax.toFixed(2)}`] : []),
    `  Total: $${total.toFixed(2)}`,
  ].join("\n");

  return [
    `Hi @${buyerHandle}! 🎉 Congrats on claiming ${itemCode} — ${itemTitle}${size ? ` (Size: ${size})` : ""}!`,
    "",
    `Here's your price breakdown:\n${breakdown}`,
    "",
    "Your secure checkout link:",
    checkoutUrl,
    "",
    `⏰ Link expires ${expireStr}. Payment locks in your order — no need to DM us once paid!`,
    "",
    "Questions? Just reply here. Thank you for shopping with BingBing Jade! 💚",
  ].join("\n");
}
