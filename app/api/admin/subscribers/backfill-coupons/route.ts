import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateSubscriberCouponCode } from "@/lib/discount";

const NUMERIC_ONLY = /^\d+$/;

/**
 * POST /api/admin/subscribers/backfill-coupons
 *
 * Assigns or regenerates welcome coupon codes for all unredeemed subscribers:
 *  - Subscribers with no code (welcome_coupon_code IS NULL)
 *  - Subscribers with a legacy numeric-only code (pre-alphanumeric migration)
 *
 * Always resets the 30-day expiry window from now.
 * Does NOT send emails — use bulk email from /subscribers-admin to notify.
 * Returns { assigned, skipped } counts.
 */
export async function POST(req: NextRequest) {
  void req;
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all subscribers — include already-redeemed ones so every row
  // gets a code for record-keeping. Validation still blocks double-use.
  const { data: eligible } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, welcome_coupon_code");

  if (!eligible || eligible.length === 0) {
    return NextResponse.json({ assigned: 0, skipped: 0 });
  }

  // Target: no code OR existing code that is purely numeric (legacy format)
  const toAssign = eligible.filter(
    (s) => !s.welcome_coupon_code || NUMERIC_ONLY.test(s.welcome_coupon_code)
  );

  if (toAssign.length === 0) {
    return NextResponse.json({ assigned: 0, skipped: 0 });
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  let assigned = 0;
  let skipped = 0;

  for (const sub of toAssign) {
    let success = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateSubscriberCouponCode();
      const { error } = await supabaseAdmin
        .from("email_subscribers")
        .update({ welcome_coupon_code: code, welcome_coupon_expires_at: expiresAt })
        .eq("id", sub.id);

      if (!error) { success = true; break; }
      // unique violation on the code → retry
    }
    if (success) assigned++; else skipped++;
  }

  return NextResponse.json({ assigned, skipped });
}
