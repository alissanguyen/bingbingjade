import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendCustomerCouponEmail } from "@/lib/discount-emails";

// GET /api/admin/coupons — list all campaigns with redemption counts
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  void req;

  const { data: campaigns, error } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch redemption counts for each campaign
  const ids = (campaigns ?? []).map((c) => c.id);
  const counts: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: redemptions } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("campaign_id")
      .in("campaign_id", ids)
      .neq("status", "cancelled");

    (redemptions ?? []).forEach((r) => {
      counts[r.campaign_id] = (counts[r.campaign_id] ?? 0) + 1;
    });
  }

  return NextResponse.json(
    (campaigns ?? []).map((c) => ({ ...c, redemption_count: counts[c.id] ?? 0 }))
  );
}

// POST /api/admin/coupons — create a new campaign
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    code?: string;
    name?: string;
    discount_type?: "fixed" | "percent" | "tiered";
    discount_value?: number | null;
    active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    new_customers_only?: boolean;
    minimum_order_amount?: number | null;
    max_redemptions_per_customer?: number;
    max_total_redemptions?: number | null;
    notes?: string | null;
    customer_email?: string | null;
    coupon_purpose?: "thank_you" | "retention" | null;
    scheduled_send_at?: string | null;
    never_expires?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required." }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required." }, { status: 400 });
  if (!body.discount_type) return NextResponse.json({ error: "discount_type is required." }, { status: 400 });

  if (body.discount_type !== "tiered" && (body.discount_value == null || body.discount_value <= 0)) {
    return NextResponse.json({ error: "discount_value is required for fixed/percent types." }, { status: 400 });
  }

  const customerEmail = body.customer_email?.trim().toLowerCase() || null;
  const couponPurpose = body.coupon_purpose ?? null;
  const scheduledSendAt = body.scheduled_send_at || null;
  const isFutureSchedule = scheduledSendAt && new Date(scheduledSendAt) > new Date();

  // Customer coupons expire in 3 months — unless never_expires is set (e.g. giveaways)
  const endsAt = customerEmail && !body.never_expires
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : (body.ends_at || null);

  const { data, error } = await supabaseAdmin
    .from("coupon_campaigns")
    .insert({
      code,
      name: body.name.trim(),
      discount_type: body.discount_type,
      discount_value: body.discount_type === "tiered" ? null : (body.discount_value ?? null),
      active: body.active ?? true,
      starts_at: body.starts_at || null,
      ends_at: endsAt,
      new_customers_only: body.new_customers_only ?? false,
      minimum_order_amount: body.minimum_order_amount ?? null,
      max_redemptions_per_customer: body.max_redemptions_per_customer ?? 1,
      max_total_redemptions: body.max_total_redemptions ?? null,
      notes: body.notes?.trim() || null,
      created_by: "admin",
      customer_email: customerEmail,
      coupon_purpose: couponPurpose,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "A campaign with this code already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email — immediately or via Resend's native scheduledAt if a future time was given.
  // Store email_sent_at = scheduledAt for future sends (so admin sees when it's queued for),
  // or email_sent_at = now for immediate sends.
  if (customerEmail && couponPurpose && data) {
    const discountType = body.discount_type!;
    const discountValue = body.discount_value;
    const discountLabel =
      discountType === "tiered"
        ? "$10/$20 off"
        : discountType === "percent"
        ? `${discountValue}% off`
        : `$${discountValue} off`;

    const endsAtDate = endsAt ? new Date(endsAt) : null;
    // For future schedules, record the scheduled time; for immediate, record now.
    const emailSentAt = isFutureSchedule ? scheduledSendAt! : new Date().toISOString();

    // Fire-and-forget — don't fail the create if email fails
    sendCustomerCouponEmail({
      customerEmail,
      couponCode: code,
      purpose: couponPurpose,
      discountLabel,
      expiresAt: endsAtDate,
      scheduledAt: isFutureSchedule ? scheduledSendAt : null,
    })
      .then(() =>
        supabaseAdmin
          .from("coupon_campaigns")
          .update({ email_sent_at: emailSentAt })
          .eq("id", data.id)
      )
      .catch((err) => console.error("[coupons] Failed to send customer coupon email:", err));
  }

  return NextResponse.json(data, { status: 201 });
}
