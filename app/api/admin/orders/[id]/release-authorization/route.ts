import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { sendAuthorizationReleasedEmail } from "@/lib/orders";

// Statuses from which an authorization can still be released. 'authorized' is
// the normal case; 'authorization_expired' means Stripe already auto-cancelled
// the hold, but the order still needs the same DB/customer-facing cleanup.
const RELEASABLE_STATUSES = new Set(["authorized", "authorization_expired"]);

// PaymentIntent statuses Stripe will actually let us cancel.
const CANCELABLE_PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

// Admin action: "Piece Unavailable — Release Authorization". Cancels the
// PaymentIntent hold (no refund — nothing was ever captured), cancels the
// order, restores the linked products to available, and emails the customer.
//
// Idempotent: safe to click twice, safe to race against the payment_intent.canceled
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

  if (order.capture_status === "authorization_canceled") {
    const { data: current } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
    return NextResponse.json({ order: current, alreadyReleased: true });
  }

  if (order.capture_status === "captured" || order.capture_status === "refunded" || order.capture_status === "partially_refunded") {
    return NextResponse.json(
      { error: "Payment has already been captured — cannot release authorization. Issue a refund instead." },
      { status: 409 }
    );
  }

  if (!RELEASABLE_STATUSES.has(order.capture_status)) {
    return NextResponse.json(
      { error: `This authorization cannot be released (current status: ${order.capture_status}).` },
      { status: 409 }
    );
  }

  // Always verify against live Stripe state before acting.
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve payment intent from Stripe.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (pi.status === "succeeded") {
    return NextResponse.json(
      { error: "Payment has already been captured on Stripe — cannot release authorization. Issue a refund instead." },
      { status: 409 }
    );
  }

  // Atomic conditional update — loses the race gracefully if a concurrent
  // request (double-click, or the webhook reconciliation) already released it.
  const { data: locked } = await supabaseAdmin
    .from("orders")
    .update({ latest_stripe_status: pi.status })
    .eq("id", order.id)
    .in("capture_status", ["authorized", "authorization_expired"])
    .select("id")
    .maybeSingle();

  if (!locked) {
    const { data: current } = await supabaseAdmin.from("orders").select("*").eq("id", id).single();
    return NextResponse.json({ order: current, alreadyReleased: current?.capture_status === "authorization_canceled" });
  }

  if (CANCELABLE_PI_STATUSES.has(pi.status)) {
    try {
      await stripe.paymentIntents.cancel(order.stripe_payment_intent_id, {
        idempotencyKey: `release_${order.id}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe cancellation failed.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
  // If pi.status === "canceled" already (Stripe auto-expired it), nothing to
  // cancel — just proceed to the DB/customer-facing cleanup below.

  const now = new Date().toISOString();
  const { data: updated } = await supabaseAdmin
    .from("orders")
    .update({
      capture_status: "authorization_canceled",
      authorization_canceled_at: now,
      latest_stripe_status: "canceled",
      order_status: "order_cancelled",
      cancellation_reason: "piece_unavailable",
    })
    .eq("id", order.id)
    .select("*")
    .single();

  // Restore linked products/options to available — the piece was never sold.
  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_option_id")
    .eq("order_id", order.id);

  const productIds = (orderItems ?? []).map((i) => i.product_id).filter((v): v is string => !!v);
  const optionIds = (orderItems ?? []).map((i) => i.product_option_id).filter((v): v is string => !!v);
  if (optionIds.length > 0) {
    await supabaseAdmin.from("product_options").update({ status: "available" }).in("id", optionIds);
  }
  if (productIds.length > 0) {
    await supabaseAdmin.from("products").update({ status: "available" }).in("id", productIds);
  }

  if (order.order_number && order.customer_name && order.customer_email) {
    try {
      await sendAuthorizationReleasedEmail({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
      });
    } catch (err) {
      console.error("[release-authorization] Email failed (non-fatal):", err);
    }
  }

  return NextResponse.json({ order: updated });
}
