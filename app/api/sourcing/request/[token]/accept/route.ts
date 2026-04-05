import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { getAvailableCredit, computeCheckoutBreakdown, CHECKOUT_OFFER_HOURS } from "@/lib/sourcing-workflow";
import { sendCheckoutOfferEmail } from "@/lib/sourcing-emails";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

// POST /api/sourcing/request/[token]/accept
// Body: { optionId, attemptId }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, customer_name, customer_email, public_token, sourcing_status, payment_status, credit_expires_at")
    .eq("public_token", token)
    .maybeSingle();

  if (!sourcingReq) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (sourcingReq.payment_status !== "paid") {
    return NextResponse.json({ error: "Deposit not paid." }, { status: 400 });
  }
  if (["fulfilled", "cancelled", "closed"].includes(sourcingReq.sourcing_status)) {
    return NextResponse.json({ error: "Request is no longer active." }, { status: 400 });
  }
  if (sourcingReq.credit_expires_at && new Date(sourcingReq.credit_expires_at) < new Date()) {
    return NextResponse.json({ error: "Sourcing credit has expired." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const optionId  = typeof body.optionId  === "string" ? body.optionId  : null;
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  if (!optionId || !attemptId) {
    return NextResponse.json({ error: "optionId and attemptId are required." }, { status: 400 });
  }

  // Verify attempt is valid and still within response window
  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, status, response_due_at")
    .eq("id", attemptId)
    .eq("sourcing_request_id", sourcingReq.id)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (!["sent", "responded"].includes(attempt.status)) {
    return NextResponse.json({ error: "This round is no longer open." }, { status: 400 });
  }
  if (attempt.response_due_at && new Date(attempt.response_due_at) < new Date()) {
    return NextResponse.json({ error: "The response window has closed." }, { status: 400 });
  }

  // Verify option
  const { data: option } = await supabaseAdmin
    .from("sourcing_attempt_options")
    .select("id, title, images_json, price_cents, status")
    .eq("id", optionId)
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (!option) return NextResponse.json({ error: "Option not found." }, { status: 404 });
  if (!["active", "responded"].includes(option.status) && option.status !== "active") {
    return NextResponse.json({ error: "Option is not available for acceptance." }, { status: 400 });
  }

  // Prevent duplicate active offers
  const { data: existingOffer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, status, stripe_checkout_session_id")
    .eq("sourcing_request_id", sourcingReq.id)
    .in("status", ["pending_checkout"])
    .maybeSingle();

  if (existingOffer) {
    // Try to reuse if Stripe session still open
    if (existingOffer.stripe_checkout_session_id) {
      try {
        const sess = await stripe.checkout.sessions.retrieve(existingOffer.stripe_checkout_session_id);
        if (sess.url && sess.status === "open") {
          return NextResponse.json({ url: sess.url });
        }
      } catch { /* session gone */ }
    }
    // Expire the stale offer
    await supabaseAdmin
      .from("sourcing_checkout_offers")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", existingOffer.id);
  }

  // Compute pricing
  const { availableCents } = await getAvailableCredit(sourcingReq.id);
  const { creditApplied, shipping, txFee, finalAmount } = computeCheckoutBreakdown(
    option.price_cents,
    availableCents
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHECKOUT_OFFER_HOURS * 60 * 60 * 1000);

  // Create checkout offer row first (get the ID for Stripe metadata)
  const { data: offer, error: offerErr } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .insert({
      sourcing_request_id:           sourcingReq.id,
      sourcing_attempt_id:           attemptId,
      sourcing_attempt_option_id:    optionId,
      customer_email:                sourcingReq.customer_email,
      title_snapshot:                option.title,
      images_snapshot_json:          option.images_json ?? [],
      price_cents:                   option.price_cents,
      currency:                      "usd",
      sourcing_credit_applied_cents: creditApplied,
      shipping_cents:                shipping,
      tx_fee_cents:                  txFee,
      final_amount_cents:            finalAmount,
      status:                        "pending_checkout",
      expires_at:                    expiresAt.toISOString(),
    })
    .select("id, public_token")
    .single();

  if (offerErr || !offer) {
    console.error("[accept] Offer insert failed:", offerErr);
    return NextResponse.json({ error: "Failed to create checkout offer." }, { status: 500 });
  }

  // Mark option as converted
  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "converted_to_checkout", updated_at: now.toISOString() })
    .eq("id", optionId);

  // Update request status
  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "accepted_pending_checkout", updated_at: now.toISOString() })
    .eq("id", sourcingReq.id);

  // Create Stripe Checkout Session
  let stripeSession: { id: string; url: string | null };
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: option.title,
              description: `Custom sourced jade piece${creditApplied > 0 ? ` (includes $${(creditApplied / 100).toFixed(0)} sourcing credit applied)` : ""}`,
            },
            unit_amount: finalAmount > 0 ? finalAmount : 50, // Stripe min $0.50
          },
          quantity: 1,
        },
      ],
      customer_email: sourcingReq.customer_email,
      success_url: `${SITE_URL}/custom-sourcing/${token}/success?offer=${offer.public_token}`,
      cancel_url:  `${SITE_URL}/custom-sourcing/${token}`,
      expires_at:  Math.floor(expiresAt.getTime() / 1000),
      metadata: {
        is_sourcing_offer_checkout:          "true",
        sourcing_checkout_offer_id:          offer.id,
        sourcing_request_id:                 sourcingReq.id,
        sourcing_attempt_option_id:          optionId,
        sourcing_credit_applied_cents:       String(creditApplied),
        customer_email:                      sourcingReq.customer_email,
      },
    });
  } catch (err) {
    console.error("[accept] Stripe session creation failed:", err);
    // Clean up offer
    await supabaseAdmin.from("sourcing_checkout_offers").delete().eq("id", offer.id);
    await supabaseAdmin
      .from("sourcing_attempt_options")
      .update({ status: "active", updated_at: now.toISOString() })
      .eq("id", optionId);
    return NextResponse.json({ error: "Payment setup failed. Please try again." }, { status: 500 });
  }

  // Store Stripe session ID on offer
  await supabaseAdmin
    .from("sourcing_checkout_offers")
    .update({
      stripe_checkout_session_id: stripeSession.id,
      updated_at: now.toISOString(),
    })
    .eq("id", offer.id);

  // Send checkout offer email
  await sendCheckoutOfferEmail({
    customerName:       sourcingReq.customer_name,
    customerEmail:      sourcingReq.customer_email,
    publicToken:        token,
    offerToken:         offer.public_token,
    itemTitle:          option.title,
    finalAmountCents:   finalAmount,
    creditAppliedCents: creditApplied,
    expiresAt:          expiresAt.toISOString(),
  });

  return NextResponse.json({ url: stripeSession.url });
}
