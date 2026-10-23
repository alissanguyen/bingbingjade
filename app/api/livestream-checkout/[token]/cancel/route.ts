import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("id, status, checkout_active, checkout_session_id, product_id, buyer_handle")
    .eq("checkout_token", token)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  if (!item.checkout_active || item.status !== "checkout_sent")
    return NextResponse.json({ error: "No active checkout to cancel" }, { status: 409 });

  // Expire Stripe session if one was created
  if (item.checkout_session_id) {
    try {
      await stripe.checkout.sessions.expire(item.checkout_session_id);
    } catch {
      // Already expired — ignore
    }
  }

  // Release product reservation
  if (item.product_id) {
    await supabaseAdmin
      .from("products")
      .update({
        status: "available",
        reserved_until: null,
        reserved_for_handle: null,
        reserved_livestream_item_id: null,
      })
      .eq("id", item.product_id);
  }

  // Reset item to available
  await supabaseAdmin
    .from("livestream_items")
    .update({
      status: "available",
      checkout_active: false,
      buyer_handle: null,
      buyer_platform: null,
      checkout_price: null,
      price_override_note: null,
      checkout_url: null,
      checkout_session_id: null,
      checkout_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await supabaseAdmin.from("livestream_item_events").insert({
    livestream_item_id: item.id,
    event_type: "cancelled_by_buyer",
    message: `Claim cancelled by buyer${item.buyer_handle ? ` (@${item.buyer_handle})` : ""} — item returned to available`,
    buyer_handle: item.buyer_handle ?? null,
    created_by: "buyer",
  });

  return NextResponse.json({ ok: true });
}
