import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { createShipmentsForOrder, recordOrderPayment, sendOrderConfirmationEmail, fetchEmailItems } from "@/lib/orders";

type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  stripe_payment_intent_id: string | null;
  capture_status: string | null;
};

// Admin action: "Confirm Available & Capture Payment" for a Sourced for You
// order that was authorized (not charged) at checkout. Captures the exact
// authorized amount — no amount override — and triggers normal fulfillment.
//
// Idempotent: safe to click twice, safe to race against the payment_intent.succeeded
// webhook reconciliation in app/api/stripe/webhook/route.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, stripe_payment_intent_id, capture_status")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!order.stripe_payment_intent_id || !order.capture_status) {
    return NextResponse.json({ error: "This order does not use manual capture." }, { status: 400 });
  }

  if (order.capture_status === "captured") {
    const { data: current } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
    return NextResponse.json({ order: current, alreadyCaptured: true });
  }

  if (order.capture_status !== "authorized") {
    return NextResponse.json(
      { error: `This authorization can no longer be captured (current status: ${order.capture_status}).` },
      { status: 409 }
    );
  }

  // Always verify against live Stripe state before acting — never trust our
  // stored authorization_expires_at estimate for actual capturability.
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve payment intent from Stripe.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (pi.status !== "requires_capture") {
    if (pi.status === "succeeded") {
      // Stripe is already ahead of our DB (e.g. a prior request's Stripe call
      // succeeded but our own write didn't land) — sync idempotently.
      const finalized = await finalizeCapture(order as OrderRow, pi);
      return NextResponse.json({ order: finalized, alreadyCaptured: true });
    }
    return NextResponse.json(
      { error: `Authorization is no longer capturable — current Stripe status: ${pi.status}.` },
      { status: 409 }
    );
  }

  // Atomic conditional update — loses the race gracefully if a concurrent
  // request (double-click, or the webhook reconciliation) already captured.
  const { data: locked } = await supabaseAdmin
    .from("orders")
    .update({ latest_stripe_status: pi.status })
    .eq("id", order.id)
    .eq("capture_status", "authorized")
    .select("id")
    .maybeSingle();

  if (!locked) {
    const { data: current } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
    return NextResponse.json({ order: current, alreadyCaptured: current?.capture_status === "captured" });
  }

  let captured: Stripe.PaymentIntent;
  try {
    captured = await stripe.paymentIntents.capture(order.stripe_payment_intent_id, {
      idempotencyKey: `capture_${order.id}`,
    });
  } catch (err) {
    await supabaseAdmin
      .from("orders")
      .update({ capture_status: "capture_failed" })
      .eq("id", order.id)
      .eq("capture_status", "authorized");
    const msg = err instanceof Error ? err.message : "Stripe capture failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const finalized = await finalizeCapture(order as OrderRow, captured);
  return NextResponse.json({ order: finalized });
}

async function finalizeCapture(order: OrderRow, pi: Stripe.PaymentIntent) {
  const { data: updated } = await supabaseAdmin
    .from("orders")
    .update({
      capture_status: "captured",
      captured_amount: pi.amount_received,
      captured_at: new Date().toISOString(),
      latest_stripe_status: pi.status,
      status: "paid",
      order_status: "order_confirmed",
    })
    .eq("id", order.id)
    .select("*")
    .single();

  await createShipmentsForOrder(order.id, order.order_number ?? null);
  await recordOrderPayment({
    orderId: order.id,
    orderNumber: order.order_number ?? null,
    paymentIntentId: pi.id,
    amountTotalCents: pi.amount_received,
    currency: pi.currency,
    createdAtIso: new Date().toISOString(),
    notes: `Stripe manual capture ${pi.id}`,
  });

  if (order.order_number && order.customer_name && order.customer_email) {
    try {
      const items = await fetchEmailItems(order.id);
      await sendOrderConfirmationEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        amountTotalCents: pi.amount_received,
        items,
      });
    } catch (err) {
      console.error("[capture-payment] Confirmation email failed (non-fatal):", err);
    }
  }

  return updated;
}
