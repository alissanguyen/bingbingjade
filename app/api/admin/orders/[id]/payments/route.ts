import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

const VALID_PROVIDERS = ["stripe", "paypal", "zelle", "bank_transfer", "cash", "other"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

// GET — list every payment recorded against this order (the ledger Cash
// Received / Full Detailed Accounting sum from).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("order_payments")
    .select("*")
    .eq("order_id", id)
    .order("payment_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

// POST — record a payment actually collected against this order (in full or
// as an additional installment/correction on top of whatever's already
// recorded). Manual/off-platform only — Stripe payments are recorded by the
// webhook, never through this route.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    amountUsd?: number;
    provider?: Provider;
    paymentDate?: string;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.amountUsd !== "number" || body.amountUsd <= 0) {
    return NextResponse.json({ error: "A positive amount is required." }, { status: 400 });
  }
  if (!body.provider || !VALID_PROVIDERS.includes(body.provider)) {
    return NextResponse.json({ error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` }, { status: 400 });
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("order_number, currency")
    .eq("id", id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const paymentDate = body.paymentDate ? new Date(body.paymentDate).toISOString() : new Date().toISOString();

  const { data: payment, error } = await supabaseAdmin
    .from("order_payments")
    .insert({
      order_id: id,
      bbj_order_code: order.order_number,
      payment_provider: body.provider,
      payment_type: "manual",
      amount_paid_usd: body.amountUsd,
      payment_fee_usd: 0,
      net_received_usd: body.amountUsd,
      currency: (order.currency ?? "usd").toUpperCase(),
      payment_date: paymentDate,
      payment_status: "paid",
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !payment) return NextResponse.json({ error: error?.message ?? "Failed to record payment." }, { status: 500 });
  return NextResponse.json({ payment }, { status: 201 });
}
