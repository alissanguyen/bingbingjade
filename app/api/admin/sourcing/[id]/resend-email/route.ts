import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { getAvailableCredit, CHECKOUT_OFFER_HOURS } from "@/lib/sourcing-workflow";
import {
  sendDepositConfirmationEmail,
  sendAttemptEmail,
  sendCheckoutOfferEmail,
} from "@/lib/sourcing-emails";

export const dynamic = "force-dynamic";

// POST /api/admin/sourcing/[id]/resend-email
// Determines what the last outbound customer email was and resends it.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select(`
      id, public_token, customer_name, customer_email,
      category, request_type, deposit_amount_cents,
      payment_status, sourcing_status,
      max_attempts, attempts_used
    `)
    .eq("id", id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (req.payment_status !== "paid") {
    return NextResponse.json({ error: "Deposit not yet paid — no customer email to resend." }, { status: 400 });
  }
  if (!req.public_token) {
    return NextResponse.json({ error: "Missing public_token." }, { status: 500 });
  }

  const status = req.sourcing_status as string;

  // ── Case 1: accepted_pending_checkout → resend checkout offer email ────────
  if (status === "accepted_pending_checkout") {
    const { data: offer } = await supabaseAdmin
      .from("sourcing_checkout_offers")
      .select("id, public_token, title_snapshot, final_amount_cents, sourcing_credit_applied_cents, expires_at")
      .eq("sourcing_request_id", id)
      .eq("status", "pending_checkout")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!offer) {
      return NextResponse.json({ error: "No active checkout offer found." }, { status: 400 });
    }

    await sendCheckoutOfferEmail({
      customerName:       req.customer_name,
      customerEmail:      req.customer_email,
      publicToken:        req.public_token,
      offerToken:         offer.public_token,
      itemTitle:          offer.title_snapshot,
      finalAmountCents:   offer.final_amount_cents,
      creditAppliedCents: offer.sourcing_credit_applied_cents,
      expiresAt:          offer.expires_at ?? new Date(Date.now() + CHECKOUT_OFFER_HOURS * 3600_000).toISOString(),
    });

    return NextResponse.json({ ok: true, resent: "checkout_offer" });
  }

  // ── Case 2: awaiting_response or responded → resend attempt email ──────────
  if (status === "awaiting_response" || status === "responded") {
    const { data: attempt } = await supabaseAdmin
      .from("sourcing_attempts")
      .select(`
        id, attempt_number, response_due_at,
        sourcing_attempt_options (id, status)
      `)
      .eq("sourcing_request_id", id)
      .in("status", ["sent", "responded"])
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: "No sent attempt found." }, { status: 400 });
    }

    const optionCount = (attempt.sourcing_attempt_options ?? []).filter(
      (o: { status: string }) => o.status === "active" || o.status === "responded"
    ).length;

    await sendAttemptEmail({
      customerName:  req.customer_name,
      customerEmail: req.customer_email,
      publicToken:   req.public_token,
      attemptNumber: attempt.attempt_number,
      maxAttempts:   req.max_attempts,
      responseDueAt: attempt.response_due_at ?? new Date(Date.now() + 72 * 3600_000).toISOString(),
      optionCount,
    });

    return NextResponse.json({ ok: true, resent: "attempt", attemptNumber: attempt.attempt_number });
  }

  // ── Case 3: queued / in_progress / anything else → resend deposit confirmation
  const { availableCents } = await getAvailableCredit(id);
  if (availableCents <= 0 && status !== "queued" && status !== "in_progress") {
    return NextResponse.json({ error: "No appropriate email to resend for this status." }, { status: 400 });
  }

  await sendDepositConfirmationEmail({
    customerName:  req.customer_name,
    customerEmail: req.customer_email,
    publicToken:   req.public_token,
    category:      req.category,
    requestType:   req.request_type,
    depositCents:  req.deposit_amount_cents,
  });

  return NextResponse.json({ ok: true, resent: "deposit_confirmation" });
}
