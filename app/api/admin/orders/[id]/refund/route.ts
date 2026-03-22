import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("id, stripe_payment_intent_id, amount_total, status")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "Order is already refunded" }, { status: 409 });
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "No Stripe payment intent on this order — issue refund manually." },
      { status: 400 }
    );
  }

  try {
    await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe refund failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "refunded", order_status: "order_cancelled" })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: "Stripe refund issued but DB update failed — check manually." },
      { status: 500 }
    );
  }

  return NextResponse.json({ order: updated });
}
