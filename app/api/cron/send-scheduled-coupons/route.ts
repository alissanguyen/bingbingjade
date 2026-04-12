import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendCustomerCouponEmail, sendCustomerCouponReminderEmail } from "@/lib/discount-emails";

// GET /api/cron/send-scheduled-coupons
// Called by Vercel Cron hourly — handles three jobs:
//   1. Scheduled initial sends (scheduled_send_at has passed, email_sent_at is null)
//   2. Reminder 1 — 30 days after email_sent_at, if unredeemed
//   3. Reminder 2 — 60 days after email_sent_at, if unredeemed
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { scheduled: 0, reminder1: 0, reminder2: 0, failed: 0 };

  // ── 1. Scheduled initial sends ──────────────────────────────────────────────
  const { data: scheduled } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, customer_email, coupon_purpose, discount_type, discount_value, ends_at")
    .not("customer_email", "is", null)
    .not("coupon_purpose", "is", null)
    .not("scheduled_send_at", "is", null)
    .is("email_sent_at", null)
    .lte("scheduled_send_at", now.toISOString());

  for (const c of scheduled ?? []) {
    const discountLabel = buildDiscountLabel(c);
    try {
      await sendCustomerCouponEmail({
        customerEmail: c.customer_email!,
        couponCode: c.code,
        purpose: c.coupon_purpose!,
        discountLabel,
        expiresAt: c.ends_at ? new Date(c.ends_at) : null,
      });
      await supabaseAdmin
        .from("coupon_campaigns")
        .update({ email_sent_at: now.toISOString() })
        .eq("id", c.id);
      results.scheduled++;
    } catch {
      results.failed++;
    }
  }

  // ── Helper: get redeemed campaign IDs ──────────────────────────────────────
  async function getRedeemedIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const { data } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("campaign_id")
      .in("campaign_id", ids)
      .neq("status", "cancelled");
    return new Set((data ?? []).map((r) => r.campaign_id));
  }

  // ── 2. Reminder 1 — 30 days after initial send ─────────────────────────────
  const reminder1Cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: r1Candidates } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, customer_email, coupon_purpose, discount_type, discount_value, ends_at")
    .not("customer_email", "is", null)
    .not("email_sent_at", "is", null)
    .is("reminder1_sent_at", null)
    .lte("email_sent_at", reminder1Cutoff)
    .gt("ends_at", now.toISOString()); // still valid

  if (r1Candidates?.length) {
    const redeemed = await getRedeemedIds(r1Candidates.map((c) => c.id));
    for (const c of r1Candidates) {
      if (redeemed.has(c.id)) continue;
      try {
        await sendCustomerCouponReminderEmail({
          customerEmail: c.customer_email!,
          couponCode: c.code,
          discountLabel: buildDiscountLabel(c),
          expiresAt: new Date(c.ends_at!),
          reminderNumber: 1,
        });
        await supabaseAdmin
          .from("coupon_campaigns")
          .update({ reminder1_sent_at: now.toISOString() })
          .eq("id", c.id);
        results.reminder1++;
      } catch {
        results.failed++;
      }
    }
  }

  // ── 3. Reminder 2 — 60 days after initial send ─────────────────────────────
  const reminder2Cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: r2Candidates } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, customer_email, coupon_purpose, discount_type, discount_value, ends_at")
    .not("customer_email", "is", null)
    .not("email_sent_at", "is", null)
    .not("reminder1_sent_at", "is", null)
    .is("reminder2_sent_at", null)
    .lte("email_sent_at", reminder2Cutoff)
    .gt("ends_at", now.toISOString()); // still valid

  if (r2Candidates?.length) {
    const redeemed = await getRedeemedIds(r2Candidates.map((c) => c.id));
    for (const c of r2Candidates) {
      if (redeemed.has(c.id)) continue;
      try {
        await sendCustomerCouponReminderEmail({
          customerEmail: c.customer_email!,
          couponCode: c.code,
          discountLabel: buildDiscountLabel(c),
          expiresAt: new Date(c.ends_at!),
          reminderNumber: 2,
        });
        await supabaseAdmin
          .from("coupon_campaigns")
          .update({ reminder2_sent_at: now.toISOString() })
          .eq("id", c.id);
        results.reminder2++;
      } catch {
        results.failed++;
      }
    }
  }

  return NextResponse.json(results);
}

function buildDiscountLabel(c: {
  discount_type: string;
  discount_value: number | null;
}): string {
  if (c.discount_type === "tiered") return "$10/$20 off";
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  return `$${c.discount_value} off`;
}
