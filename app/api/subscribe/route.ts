import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeEmail, assignSubscriberCoupon } from "@/lib/discount";
import { sendWelcomeSubscriberEmail } from "@/lib/discount-emails";

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawEmail = body.email ?? "";
  if (!rawEmail || typeof rawEmail !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  // Check if this email has ever subscribed (including previously unsubscribed rows)
  const { data: existing } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, unsubscribed_at, welcome_coupon_code")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (!existing.unsubscribed_at) {
      // Currently subscribed — no-op
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    // Previously unsubscribed — reactivate without issuing a new coupon.
    // The existing coupon history (welcome_coupon_code, welcome_discount_redeemed_at)
    // is intentionally preserved to prevent subscribe→coupon→unsubscribe→repeat abuse.
    await supabaseAdmin
      .from("email_subscribers")
      .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
      .eq("id", existing.id);

    await supabaseAdmin
      .from("customers")
      .update({
        marketing_opt_in: true,
        marketing_opt_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("customer_email", email)
      .eq("marketing_opt_in", false);

    return NextResponse.json({ success: true, alreadySubscribed: false });
  }

  // New subscriber — insert row
  const { error: insertError } = await supabaseAdmin.from("email_subscribers").insert({
    email,
    source: body.source ?? "website",
  });

  if (insertError) {
    // Handle race condition: another request inserted between our check and insert
    if ((insertError as { code?: string }).code === "23505") {
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }
    console.error("[subscribe] Insert failed:", insertError);
    return NextResponse.json({ error: "Subscription failed. Please try again." }, { status: 500 });
  }

  // Fetch the new subscriber ID so we can assign their coupon
  const { data: newSubscriber } = await supabaseAdmin
    .from("email_subscribers")
    .select("id")
    .eq("email", email)
    .single();

  // Also update customer record if they already exist (marketing_opt_in sync)
  await supabaseAdmin
    .from("customers")
    .update({
      marketing_opt_in: true,
      marketing_opt_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("customer_email", email)
    .eq("marketing_opt_in", false);

  // Assign a unique 6-digit welcome coupon, then send the welcome email.
  // Must be awaited — fire-and-forget gets killed by Vercel before the email sends.
  if (newSubscriber) {
    try {
      const { code, expiresAt } = await assignSubscriberCoupon(newSubscriber.id);
      await sendWelcomeSubscriberEmail(email, code, expiresAt);
    } catch (err) {
      console.error("[subscribe] Coupon assign or welcome email failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ success: true, alreadySubscribed: false });
}
