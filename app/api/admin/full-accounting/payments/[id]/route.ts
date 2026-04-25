import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// PATCH /api/admin/full-accounting/payments/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  // Recompute net if amount or fee changed but net not explicitly provided
  const updates: Record<string, unknown> = {};
  const allowed = [
    "order_id", "bbj_order_code", "payment_provider", "payment_type",
    "provider_transaction_id", "provider_receipt_id", "provider_invoice_id",
    "amount_paid_usd", "currency", "payment_fee_usd", "net_received_usd",
    "payment_date", "payment_status", "proof_url", "notes",
  ];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Auto-derive net if amount/fee changed but net not provided
  if (("amount_paid_usd" in updates || "payment_fee_usd" in updates) && !("net_received_usd" in updates)) {
    const { data: current } = await supabaseAdmin
      .from("order_payments")
      .select("amount_paid_usd, payment_fee_usd")
      .eq("id", id)
      .single();
    if (current) {
      const amount = Number(updates.amount_paid_usd ?? current.amount_paid_usd);
      const fee    = Number(updates.payment_fee_usd  ?? current.payment_fee_usd);
      updates.net_received_usd = amount - fee;
    }
  }

  // Normalise currency to uppercase
  if (updates.currency) updates.currency = String(updates.currency).toUpperCase();

  // If bbj_order_code changed or order_id provided without bbj, keep them in sync
  if (updates.order_id && !updates.bbj_order_code) {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("id", updates.order_id as string)
      .maybeSingle();
    if (order) updates.bbj_order_code = order.order_number;
  }

  const { data, error } = await supabaseAdmin
    .from("order_payments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}

// DELETE /api/admin/full-accounting/payments/[id]
// Stripe-synced payments can be deleted here; they will be re-created on next Stripe sync.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("order_payments")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
