import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildCustomerCouponReminderHtml } from "@/lib/discount-emails";

// GET /api/admin/subscribers/[id]/preview — return the resend email HTML for preview
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: subscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("welcome_coupon_code, welcome_coupon_expires_at")
    .eq("id", id)
    .single();

  if (!subscriber?.welcome_coupon_code) {
    return NextResponse.json({ error: "No coupon code for this subscriber." }, { status: 404 });
  }

  const expiresAt = subscriber.welcome_coupon_expires_at
    ? new Date(subscriber.welcome_coupon_expires_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const html = buildCustomerCouponReminderHtml({
    couponCode: subscriber.welcome_coupon_code,
    discountLabel: "Up to $20 off your first order",
    expiresAt,
    reminderNumber: 2,
  });

  return NextResponse.json({ html });
}
