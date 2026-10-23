import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const allowed = [
    "title_snapshot", "size", "price", "minimum_price",
    "checkout_price", "price_override_note",
    "product_id", "public_notes", "private_notes", "display_order",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Changing the checkout price invalidates any Stripe session the buyer already
  // opened at the old price; the checkout page creates a fresh one on next attempt.
  let previousCheckoutPrice: number | null = null;
  let buyerHandle: string | null = null;
  if ("checkout_price" in updates) {
    const newPrice = Number(updates.checkout_price);
    if (!Number.isFinite(newPrice) || newPrice <= 0)
      return NextResponse.json({ error: "checkout_price must be > 0" }, { status: 400 });
    updates.checkout_price = newPrice;

    const { data: current } = await supabaseAdmin
      .from("livestream_items")
      .select("status, price, checkout_price, checkout_session_id, buyer_handle")
      .eq("id", itemId)
      .maybeSingle();
    if (!current) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (current.status !== "checkout_sent")
      return NextResponse.json({ error: "Checkout price can only be changed while checkout is sent" }, { status: 409 });

    previousCheckoutPrice = current.checkout_price ?? current.price;
    buyerHandle = current.buyer_handle;
    if (newPrice === previousCheckoutPrice) {
      delete updates.checkout_price;
    } else if (current.checkout_session_id) {
      try {
        await stripe.checkout.sessions.expire(current.checkout_session_id);
      } catch {
        // Already expired or completed — ignore
      }
      updates.checkout_session_id = null;
      updates.checkout_url = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("livestream_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ("checkout_price" in updates) {
    await supabaseAdmin.from("livestream_item_events").insert({
      livestream_item_id: itemId,
      event_type: "checkout_price_changed",
      message: `Checkout price changed from $${previousCheckoutPrice?.toFixed(2)} to $${Number(updates.checkout_price).toFixed(2)}`,
      buyer_handle: buyerHandle,
      metadata: { previous_price: previousCheckoutPrice, checkout_price: updates.checkout_price },
      created_by: "admin",
    });
  }
  return NextResponse.json({ item: data });
}
