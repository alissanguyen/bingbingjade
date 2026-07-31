import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendManualAcknowledgmentEmail } from "@/lib/service-emails";
import { logAudit } from "@/lib/audit";

/**
 * One-off repair tool for pre-launch gaps like order #1330-3268: a Stripe
 * charge that succeeded before the service-request platform existed, with
 * no downstream record. Never charges the customer again — only reads and
 * links the already-existing Stripe PaymentIntent, then asks for the
 * (until-now never-collected) required photos before any approval/shipping
 * step proceeds.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    serviceSlug?: string;
    customerName?: string;
    customerEmail?: string;
    stripePaymentIntentId?: string;
    stripeSessionId?: string;
    amountCents?: number;
    captured?: boolean; // true = already captured, false = authorized only (unlikely pre-launch, but supported)
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.serviceSlug || !body.customerName?.trim() || !body.customerEmail?.trim() || !body.stripePaymentIntentId || !body.amountCents) {
    return NextResponse.json(
      { error: "serviceSlug, customerName, customerEmail, stripePaymentIntentId, and amountCents are required." },
      { status: 400 }
    );
  }

  // Idempotency: never link the same Stripe PaymentIntent to two service requests.
  const { data: existing } = await supabaseAdmin
    .from("service_requests")
    .select("id, request_number")
    .eq("stripe_payment_intent_id", body.stripePaymentIntentId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ serviceRequest: existing, alreadyExists: true });
  }

  const { data: service } = await supabaseAdmin.from("services").select("*").eq("slug", body.serviceSlug).maybeSingle();
  if (!service) return NextResponse.json({ error: "Unknown service slug." }, { status: 400 });

  const now = new Date().toISOString();
  const { data: created, error } = await supabaseAdmin
    .from("service_requests")
    .insert({
      service_id: service.id,
      status: "awaiting_images",
      client_type: "new",
      customer_name: body.customerName.trim(),
      customer_email: body.customerEmail.trim().toLowerCase(),
      price_cents: body.amountCents,
      stripe_session_id: body.stripeSessionId ?? null,
      stripe_payment_intent_id: body.stripePaymentIntentId,
      capture_status: body.captured ? "captured" : "authorized",
      captured_amount: body.captured ? body.amountCents : null,
      captured_at: body.captured ? now : null,
      authorized_amount: body.captured ? null : body.amountCents,
      authorized_at: body.captured ? null : now,
      admin_instructions: "Please upload 1-5 clear photos of your jade item so we can review its condition.",
      admin_notes: `Manually backfilled by admin ${body.captured ? "(payment already captured pre-launch)" : "(authorization only)"}. ${body.note ?? ""}`.trim(),
      submitted_at: now,
    })
    .select("*, service:services(*)")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to create service request." }, { status: 500 });
  }

  await logAudit({
    actorUserId: "admin",
    action: "service_request_backfilled",
    entityType: "service_request",
    entityId: created.id,
    newValue: { stripe_payment_intent_id: body.stripePaymentIntentId, capture_status: created.capture_status },
    metadata: { reason: "pre-launch gap repair" },
  });

  await sendManualAcknowledgmentEmail({ serviceRequest: created, service: created.service }).catch((e) =>
    console.error("[admin/service-requests/backfill] email failed", e)
  );

  return NextResponse.json({ serviceRequest: created });
}
