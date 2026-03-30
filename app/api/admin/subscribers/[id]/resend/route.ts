import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resendSubscriberCouponEmail } from "@/lib/discount-emails";

// POST /api/admin/subscribers/[id]/resend — resend welcome coupon email
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
    .select("id, email, welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at")
    .eq("id", id)
    .single();

  if (!subscriber) return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
  if (!subscriber.welcome_coupon_code) {
    return NextResponse.json({ error: "Subscriber has no welcome coupon code." }, { status: 400 });
  }
  if (subscriber.welcome_discount_redeemed_at) {
    return NextResponse.json({ error: "This coupon has already been used." }, { status: 400 });
  }

  try {
    await resendSubscriberCouponEmail(
      subscriber.email,
      subscriber.welcome_coupon_code,
      new Date(subscriber.welcome_coupon_expires_at)
    );
  } catch {
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
