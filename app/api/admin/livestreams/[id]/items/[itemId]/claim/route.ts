import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { buyer_handle, buyer_platform = "instagram", checkout_price, price_override_note } = body;
  if (!buyer_handle?.trim())
    return NextResponse.json({ error: "buyer_handle is required" }, { status: 400 });

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

  // Create Stripe checkout session
  const now = new Date();
  const expiresAt = Math.floor((now.getTime() + CHECKOUT_WINDOW_HOURS * 60 * 60 * 1000) / 1000);
  const priceCents = Math.round(finalPrice * 100);

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.title_snapshot,
            ...(item.size ? { description: `Size: ${item.size}` } : {}),
          },
          unit_amount: priceCents,
        },
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
    message: `Checkout sent to @${buyer_handle.trim()} for $${finalPrice.toFixed(2)}`,
    buyer_handle: buyer_handle.trim(),
    metadata: {
      checkout_session_id: stripeSession.id,
      checkout_price: finalPrice,
      expires_at: expiresAtIso,
    },
    created_by: "admin",
  });

  // Build the DM message copy
  const tokenUrl = `${SITE_URL}/livestream-checkout/${item.checkout_token}`;
  const dmMessage = buildDMMessage({
    buyerHandle: buyer_handle.trim(),
    itemCode: item.code,
    itemTitle: item.title_snapshot,
    size: item.size,
    price: finalPrice,
    checkoutUrl: tokenUrl,
    expiresAt: expiresAtIso,
  });

  return NextResponse.json({
    ok: true,
    checkoutUrl: stripeSession.url,
    tokenUrl,
    expiresAt: expiresAtIso,
    dmMessage,
  });
}

function buildDMMessage({
  buyerHandle,
  itemCode,
  itemTitle,
  size,
  price,
  checkoutUrl,
  expiresAt,
}: {
  buyerHandle: string;
  itemCode: string;
  itemTitle: string;
  size: string | null;
  price: number;
  checkoutUrl: string;
  expiresAt: string;
}) {
  const expireDate = new Date(expiresAt);
  const expireStr = expireDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const lines = [
    `Hi @${buyerHandle}! 🎉 Congrats on claiming ${itemCode} — ${itemTitle}${size ? ` (Size: ${size})` : ""} for $${price.toFixed(2)}.`,
    "",
    "Here's your secure checkout link:",
    checkoutUrl,
    "",
    `⏰ Link expires ${expireStr}. Payment locks in your order — no need to DM us once paid!`,
    "",
    "Questions? Just reply here. Thank you for shopping with BingBing Jade! 💚",
  ];

  return lines.join("\n");
}
