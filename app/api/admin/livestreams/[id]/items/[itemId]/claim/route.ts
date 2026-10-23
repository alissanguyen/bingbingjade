import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

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

  const {
    buyer_handle,
    buyer_platform = "instagram",
    checkout_price,
    price_override_note,
  } = body;

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

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHECKOUT_WINDOW_HOURS * 60 * 60 * 1000);
  const expiresAtIso = expiresAt.toISOString();

  // Mark item as checkout_sent — buyer completes shipping + payment at /livestream-checkout/[token]
  await supabaseAdmin
    .from("livestream_items")
    .update({
      status: "checkout_sent",
      buyer_handle: buyer_handle.trim(),
      buyer_platform,
      checkout_price: finalPrice,
      price_override_note: price_override_note ?? null,
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
    message: `Checkout link sent to @${buyer_handle.trim()} for $${finalPrice.toFixed(2)} — buyer selects shipping at checkout`,
    buyer_handle: buyer_handle.trim(),
    metadata: {
      checkout_price: finalPrice,
      expires_at: expiresAtIso,
    },
    created_by: "admin",
  });

  const tokenUrl = `${SITE_URL}/livestream-checkout/${item.checkout_token}`;
  const dmMessage = buildDMMessage({
    buyerHandle: buyer_handle.trim(),
    itemCode: item.code,
    itemTitle: item.title_snapshot,
    size: item.size,
    itemPrice: finalPrice,
    tokenUrl,
    expiresAt: expiresAtIso,
  });

  return NextResponse.json({ ok: true, tokenUrl, expiresAt: expiresAtIso, dmMessage });
}

function buildDMMessage({
  buyerHandle, itemCode, itemTitle, size, itemPrice, tokenUrl, expiresAt,
}: {
  buyerHandle: string;
  itemCode: string;
  itemTitle: string;
  size: string | null;
  itemPrice: number;
  tokenUrl: string;
  expiresAt: string;
}) {
  const expireStr = new Date(expiresAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  return [
    `Hi @${buyerHandle}! 🎉 Congrats on claiming ${itemCode} — ${itemTitle}${size ? ` (Size: ${size})` : ""} for $${itemPrice.toFixed(2)}!`,
    "",
    "Here's your secure checkout link (shipping & taxes calculated at checkout):",
    tokenUrl,
    "",
    `⏰ Link expires ${expireStr}. Payment locks in your order — no need to DM us once paid!`,
    "",
    "Questions? Just reply here. Thank you for shopping with BingBing Jade! 💚",
  ].join("\n");
}
