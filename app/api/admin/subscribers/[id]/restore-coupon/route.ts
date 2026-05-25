import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/subscribers/[id]/restore-coupon
// Clears used_fingerprint and welcome_discount_redeemed_at so the subscriber
// can redeem their welcome coupon again. Also extends the expiry by 30 days
// from today so the coupon is actually usable.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: subscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, email, welcome_coupon_code, welcome_discount_redeemed_at")
    .eq("id", id)
    .single();

  if (!subscriber) return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
  if (!subscriber.welcome_coupon_code) {
    return NextResponse.json({ error: "Subscriber has no welcome coupon code." }, { status: 400 });
  }

  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 30);

  const { error } = await supabaseAdmin
    .from("email_subscribers")
    .update({
      welcome_discount_redeemed_at: null,
      used_fingerprint: null,
      welcome_coupon_expires_at: newExpiry.toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    new_expiry: newExpiry.toISOString(),
  });
}
