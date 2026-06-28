import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { stripe } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  let body: { reason?: string } = {};
  try { body = await req.json(); } catch { /* optional body */ }

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Expire the Stripe session if still open
  if (item.checkout_session_id) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(item.checkout_session_id);
      if (stripeSession.status === "open") {
        await stripe.checkout.sessions.expire(item.checkout_session_id);
      }
    } catch {
      // Session may already be expired/completed — continue
    }
  }

  const now = new Date().toISOString();

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
      .eq("id", item.product_id)
      .eq("status", "reserved"); // only release if still reserved (not already sold)
  }

  // Reset item to available
  await supabaseAdmin
    .from("livestream_items")
    .update({
      status: "available",
      buyer_handle: null,
      buyer_platform: null,
      checkout_active: false,
      checkout_url: null,
      checkout_session_id: null,
      checkout_expires_at: null,
      checkout_price: null,
      price_override_note: null,
      updated_at: now,
    })
    .eq("id", itemId);

  // Log event
  await supabaseAdmin.from("livestream_item_events").insert({
    livestream_item_id: itemId,
    event_type: "released",
    message: body.reason ? `Released: ${body.reason}` : "Released — item made available again",
    buyer_handle: item.buyer_handle,
    created_by: "admin",
  });

  return NextResponse.json({ ok: true });
}
