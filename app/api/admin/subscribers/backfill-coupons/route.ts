import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateSubscriberCouponCode } from "@/lib/discount";

/**
 * POST /api/admin/subscribers/backfill-coupons
 *
 * Generates welcome coupon codes for all existing subscribers that:
 *  - have no code yet (welcome_coupon_code IS NULL)
 *  - have not already redeemed their welcome discount
 *
 * Does NOT send emails — admin can follow up with bulk email from /subscribers-admin.
 * Returns { assigned, skipped } counts.
 */
export async function POST(req: NextRequest) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: eligible } = await supabaseAdmin
    .from("email_subscribers")
    .select("id")
    .is("welcome_coupon_code", null)
    .is("welcome_discount_redeemed_at", null);

  if (!eligible || eligible.length === 0) {
    return NextResponse.json({ assigned: 0, skipped: 0 });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  let assigned = 0;
  let skipped = 0;

  // Assign codes one at a time to handle collision retries
  for (const sub of eligible) {
    let success = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateSubscriberCouponCode();
      const { error } = await supabaseAdmin
        .from("email_subscribers")
        .update({ welcome_coupon_code: code, welcome_coupon_expires_at: expiresAt })
        .eq("id", sub.id)
        .is("welcome_coupon_code", null);

      if (!error) { success = true; break; }
      // unique violation → retry with a new code
    }
    if (success) assigned++; else skipped++;
  }

  return NextResponse.json({ assigned, skipped });
}
