import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendCustomerCouponEmail } from "@/lib/discount-emails";

function buildDiscountLabel(c: { discount_type: string; discount_value: number | null }): string {
  if (c.discount_type === "tiered") return "$10/$20 off";
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  return `$${c.discount_value} off`;
}

// POST /api/admin/coupons/[id]/resend — resend the coupon email for a customer coupon
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: campaign, error } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, customer_email, coupon_purpose, discount_type, discount_value, ends_at, email_sent_at")
    .eq("id", id)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }

  if (!campaign.customer_email || !campaign.coupon_purpose) {
    return NextResponse.json({ error: "Not a customer coupon." }, { status: 400 });
  }

  try {
    await sendCustomerCouponEmail({
      customerEmail: campaign.customer_email,
      couponCode: campaign.code,
      purpose: campaign.coupon_purpose,
      discountLabel: buildDiscountLabel(campaign),
      expiresAt: campaign.ends_at ? new Date(campaign.ends_at) : null,
    });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("coupon_campaigns")
      .update({ email_sent_at: now })
      .eq("id", id);

    return NextResponse.json({ ok: true, email_sent_at: now });
  } catch (err) {
    console.error("[coupons/resend] Failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
