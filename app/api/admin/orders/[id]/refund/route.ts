import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { restoreStoreCredit } from "@/lib/store-credit";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { manual } = (await req.json().catch(() => ({}))) as { manual?: boolean };

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, stripe_payment_intent_id, amount_total, stripe_amount_cents, store_credit_id, store_credit_used_cents, status")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "Order is already refunded" }, { status: 409 });
  }

  // Restore store credit first, up to what was originally applied to this
  // order, so a goodwill/cancellation credit can never be converted into a
  // cash refund — only the amount actually charged through Stripe is
  // refunded through Stripe.
  const hasStoreCredit = !!order.store_credit_id && order.store_credit_used_cents > 0;
  if (hasStoreCredit) {
    const restored = await restoreStoreCredit({
      storeCreditId: order.store_credit_id,
      amountCents: order.store_credit_used_cents,
      orderId: id,
      reason: `Order ${order.order_number ?? id} refunded`,
      createdBy: "admin",
    });
    if (!restored) {
      return NextResponse.json({ error: "Failed to restore store credit — refund not processed." }, { status: 500 });
    }
  }

  // Refund only what was actually sent to Stripe. stripe_amount_cents is null
  // on orders created before this column existed — those never had store
  // credit applied, so falling back to a full refund (no amount param)
  // preserves their exact prior behavior.
  const stripeRefundAmountCents = order.stripe_amount_cents ?? null;

  if (!manual) {
    if (!order.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: "No Stripe payment intent on this order — issue refund manually." },
        { status: 400 }
      );
    }
    if (stripeRefundAmountCents !== null && stripeRefundAmountCents <= 0) {
      // Fully covered by store credit — nothing was ever sent to Stripe, so
      // there is nothing to refund there. The restoration above already
      // reversed the tender.
    } else {
      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          ...(stripeRefundAmountCents !== null ? { amount: stripeRefundAmountCents } : {}),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stripe refund failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "refunded", order_status: "order_cancelled" })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: manual ? "DB update failed." : "Stripe refund issued but DB update failed — check manually." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    order: updated,
    tenderBreakdown: hasStoreCredit ? {
      restoredToStoreCreditCents: order.store_credit_used_cents,
      refundedThroughStripeCents: stripeRefundAmountCents ?? (order.amount_total - order.store_credit_used_cents),
    } : null,
  });
}
