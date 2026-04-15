import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

  // Prevent duplicate active offers — expire stale ones, preserve the original 72h window
  const { data: existingOffer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, status, expires_at, sourcing_attempt_option_id")
    .eq("sourcing_request_id", sourcingReq.id)
    .eq("status", "pending_checkout")
    .maybeSingle();

  let preservedExpiry: Date | null = null;

  if (existingOffer) {
    // If customer is re-selecting, reuse the original expiry window
    if (existingOffer.expires_at) {
      const orig = new Date(existingOffer.expires_at as string);
      if (orig > new Date()) preservedExpiry = orig;
    }
    // Revert the previously selected option back to active
    if (existingOffer.sourcing_attempt_option_id) {
      await supabaseAdmin
        .from("sourcing_attempt_options")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", existingOffer.sourcing_attempt_option_id)
        .eq("status", "converted_to_checkout");
    }
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
  // Preserve original 72h window if customer is changing their selection
  const maxExpiry = new Date(now.getTime() + CHECKOUT_OFFER_HOURS * 60 * 60 * 1000);
  const expiresAt = preservedExpiry && preservedExpiry < maxExpiry ? preservedExpiry : maxExpiry;

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

  // Send checkout offer email (fire-and-forget)
  sendCheckoutOfferEmail({
    customerName:       sourcingReq.customer_name,
    customerEmail:      sourcingReq.customer_email,
    offerToken:         offer.public_token,
    itemTitle:          option.title,
    priceCents:         option.price_cents,
    creditAppliedCents: creditApplied,
    expiresAt:          expiresAt.toISOString(),
  }).catch((e) => console.error("[accept] Checkout offer email failed:", e));

  // Direct customer to the custom checkout page — Stripe session is created there
  return NextResponse.json({
    url: `${SITE_URL}/checkout/custom-sourcing/${offer.public_token}`,
  });
}
