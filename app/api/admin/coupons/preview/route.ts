import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { buildCustomerCouponHtml, buildCustomerCouponReminderHtml } from "@/lib/discount-emails";

// POST /api/admin/coupons/preview — return HTML for the customer coupon email (no send)
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    purpose?: "thank_you" | "retention" | "giveaway";
    discount_type?: "fixed" | "percent";
    discount_value?: number | null;
    coupon_code?: string;
    reminder_number?: 1 | 2 | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const couponCode = (body.coupon_code?.trim().toUpperCase()) || "PREVIEW00";
  const discountLabel =
    body.discount_type === "percent"
      ? `${body.discount_value ?? 10}% off`
      : `$${body.discount_value ?? 15} off`;

  // Three months from now for preview expiry
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  let html: string;
  if (body.reminder_number === 1 || body.reminder_number === 2) {
    html = buildCustomerCouponReminderHtml({
      couponCode,
      discountLabel,
      expiresAt,
      reminderNumber: body.reminder_number,
    });
  } else {
    html = buildCustomerCouponHtml({
      couponCode,
      purpose: body.purpose ?? "thank_you",
      discountLabel,
      expiresAt,
    });
  }

  return NextResponse.json({ html });
}
