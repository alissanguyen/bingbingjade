import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/discount";

/**
 * POST /api/admin/coupons/redeem
 *
 * Manually marks a coupon/referral code as used for Zelle / wire-transfer orders.
 * Supports:
 *  - Subscriber welcome coupons (6-char alphanumeric)
 *  - Campaign coupon codes
 *  - Referral codes (8-char alphanumeric) — creates referral record; reward must be
 *    issued separately when the manual order is delivered.
 *
 * Body: { code, customerEmail, orderRef? }
 * Returns: { type, detail } describing what was recorded.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string; customerEmail?: string; orderRef?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required." }, { status: 400 });

  if (!body.customerEmail?.trim()) {
    return NextResponse.json({ error: "customerEmail is required." }, { status: 400 });
  }
  const email = normalizeEmail(body.customerEmail);
  const orderRef = body.orderRef?.trim() || null;

  // ── 1. Subscriber welcome coupon ─────────────────────────────────────────────
  const { data: subscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, email, welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at")
    .eq("welcome_coupon_code", code)
    .maybeSingle();

  if (subscriber) {
    if (subscriber.welcome_discount_redeemed_at) {
      return NextResponse.json(
        { error: "This welcome coupon has already been redeemed." },
        { status: 409 }
      );
    }
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("email_subscribers")
      .update({ welcome_discount_redeemed_at: now })
      .eq("id", subscriber.id);

    // Also mark customer record if one exists
    await supabaseAdmin
      .from("customers")
      .update({ welcome_discount_redeemed_at: now })
      .eq("customer_email", normalizeEmail(subscriber.email))
      .is("welcome_discount_redeemed_at", null);

    return NextResponse.json({
      type: "subscriber_coupon",
      detail: `Welcome coupon for ${subscriber.email} marked as redeemed.`,
    });
  }

  // ── 2. Campaign coupon ────────────────────────────────────────────────────────
  const { data: campaign } = await supabaseAdmin
    .from("coupon_campaigns")
    .select("id, code, name, max_redemptions_per_customer, max_total_redemptions")
    .eq("code", code)
    .maybeSingle();

  if (campaign) {
    const { data: redemption, error: insertErr } = await supabaseAdmin
      .from("coupon_redemptions")
      .insert({
        campaign_id: campaign.id,
        customer_email: email,
        discount_amount_cents: 0, // unknown for manual — admin can note separately
        status: "confirmed",
        ...(orderRef ? { order_id: null } : {}),
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      type: "campaign",
      detail: `Campaign "${campaign.name}" (${campaign.code}) redeemed for ${email}. Redemption ID: ${redemption.id}`,
    });
  }

  // ── 3. Referral code ──────────────────────────────────────────────────────────
  const { data: referrer } = await supabaseAdmin
    .from("customers")
    .select("id, customer_email, customer_name, referral_code")
    .eq("referral_code", code)
    .maybeSingle();

  if (referrer) {
    if (normalizeEmail(referrer.customer_email) === email) {
      return NextResponse.json({ error: "Customer cannot use their own referral code." }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("referrals")
      .select("id, status")
      .eq("referral_code", code)
      .eq("referred_customer_email", email)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This referral code has already been recorded for this email." },
        { status: 409 }
      );
    }

    await supabaseAdmin.from("referrals").insert({
      referrer_customer_id: referrer.id,
      referral_code: code,
      referred_customer_email: email,
      referred_order_id: null,
      status: "pending",
      discount_amount_cents: 0,
    });

    return NextResponse.json({
      type: "referral",
      detail: `Referral recorded — ${referrer.customer_name ?? referrer.customer_email} referred ${email}. Issue $10 store credit to referrer when the order is delivered.`,
    });
  }

  return NextResponse.json({ error: "Code not found." }, { status: 404 });
}
