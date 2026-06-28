import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  let body: { hours?: number } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const hours = Math.min(Math.max(body.hours ?? 24, 1), 24); // 1–24h, Stripe max is 24h from creation

  const { data: item } = await supabaseAdmin
    .from("livestream_items")
    .select("checkout_expires_at, checkout_active, status, buyer_handle")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (!item.checkout_active)
    return NextResponse.json({ error: "No active checkout to extend" }, { status: 400 });

  // Note: Stripe does not support extending a checkout session's expiry.
  // We only update our DB record so the countdown on the product page reflects the extension.
  // The actual Stripe session may expire before the extended time — buyer must use it before Stripe expiry.
  const newExpiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from("livestream_items")
    .update({ checkout_expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  // Also extend product reservation
  if (item) {
    await supabaseAdmin
      .from("products")
      .update({ reserved_until: newExpiry })
      .eq("reserved_livestream_item_id", itemId);
  }

  await supabaseAdmin.from("livestream_item_events").insert({
    livestream_item_id: itemId,
    event_type: "note",
    message: `Checkout window extended by ${hours}h — new deadline ${new Date(newExpiry).toLocaleString()}`,
    buyer_handle: item.buyer_handle,
    created_by: "admin",
  });

  return NextResponse.json({ ok: true, newExpiry });
}
