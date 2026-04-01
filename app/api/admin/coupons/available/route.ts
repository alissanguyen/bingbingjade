/**
 * GET /api/admin/coupons/available?email=xxx
 *
 * Returns available (unredeemed, unexpired) coupons for a given customer email.
 * Checks:
 *   1. email_subscribers — welcome coupon for this email (not redeemed, not expired)
 *   2. coupon_campaigns  — active campaigns the customer hasn't hit their redemption limit for
 *
 * Auth: requires admin or approved user session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/discount";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawEmail = req.nextUrl.searchParams.get("email")?.trim();
  if (!rawEmail) return NextResponse.json({ coupons: [] });
  const email = normalizeEmail(rawEmail);

  const coupons: {
    code: string;
    type: "subscriber_welcome" | "campaign";
    label: string;
    discountType?: string;
    discountValue?: number | null;
    expiresAt?: string | null;
  }[] = [];

  // ── 1. Subscriber welcome coupon ─────────────────────────────────────────────
  const { data: subscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at")
    .eq("email", email)
    .maybeSingle();

  if (subscriber?.welcome_coupon_code && !subscriber.welcome_discount_redeemed_at) {
    const expired =
      subscriber.welcome_coupon_expires_at &&
      new Date(subscriber.welcome_coupon_expires_at) < new Date();
    if (!expired) {
      coupons.push({
        code: subscriber.welcome_coupon_code,
        type: "subscriber_welcome",
        label: `${subscriber.welcome_coupon_code} — Welcome coupon ($10/$20 off first order)`,
        discountType: "tiered",
        expiresAt: subscriber.welcome_coupon_expires_at ?? null,
      });
    }
  }

  // ── 2. Active campaign coupons ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { data: campaigns } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, name, discount_type, discount_value, max_redemptions_per_customer, ends_at")
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  if (campaigns && campaigns.length > 0) {
    const campaignIds = campaigns.map((c) => c.id);

    const { data: redemptions } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("campaign_id")
      .eq("customer_email", email)
      .in("campaign_id", campaignIds)
      .neq("status", "cancelled");

    const usedCounts: Record<string, number> = {};
    for (const r of redemptions ?? []) {
      usedCounts[r.campaign_id] = (usedCounts[r.campaign_id] ?? 0) + 1;
    }

    for (const c of campaigns) {
      const used = usedCounts[c.id] ?? 0;
      const maxPerCustomer = c.max_redemptions_per_customer ?? Infinity;
      if (used < maxPerCustomer) {
        let label = `${c.code} — ${c.name}`;
        if (c.discount_type === "percent" && c.discount_value != null) {
          label += ` (${c.discount_value}% off)`;
        } else if (c.discount_type === "fixed" && c.discount_value != null) {
          label += ` ($${Number(c.discount_value).toFixed(0)} off)`;
        }
        coupons.push({
          code: c.code,
          type: "campaign",
          label,
          discountType: c.discount_type,
          discountValue: c.discount_value != null ? Number(c.discount_value) : null,
          expiresAt: c.ends_at ?? null,
        });
      }
    }
  }

  return NextResponse.json({ coupons });
}
