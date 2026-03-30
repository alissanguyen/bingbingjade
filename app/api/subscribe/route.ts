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

  // Idempotent: check if already subscribed
  const { data: existing } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, subscribed_at")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    // Already subscribed — return success without re-sending email
    return NextResponse.json({ success: true, alreadySubscribed: true });
  }

  // Insert subscriber
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

  // Assign a unique 6-digit welcome coupon, then send the welcome email
  if (newSubscriber) {
    assignSubscriberCoupon(newSubscriber.id)
      .then(({ code, expiresAt }) =>
        sendWelcomeSubscriberEmail(email, code, expiresAt)
      )
      .catch((err) => console.error("[subscribe] Coupon assign or welcome email failed (non-fatal):", err));
  }

  return NextResponse.json({ success: true, alreadySubscribed: false });
}
