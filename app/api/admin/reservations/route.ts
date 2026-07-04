import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { createHash } from "crypto";

// GET /api/admin/reservations?productId=<id>
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("product_reservations")
    .select("id, customer_name, customer_email, customer_note, deposit_amount_usd, deposit_paid, deposit_paid_at, deposit_stripe_session_id, expires_at, created_at, cancelled_at")
    .eq("product_id", productId)
    .is("cancelled_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reservation: data });
}

// POST /api/admin/reservations — create or replace a reservation
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    productId: string;
    code: string;
    customerName?: string;
    customerEmail?: string;
    customerNote?: string;
    depositAmountUsd?: number;
    expiresAt: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { productId, code, customerName, customerEmail, customerNote, depositAmountUsd, expiresAt } = body;

  if (!productId || !code || !expiresAt) {
    return NextResponse.json({ error: "productId, code, and expiresAt are required." }, { status: 400 });
  }

  if (new Date(expiresAt) <= new Date()) {
    return NextResponse.json({ error: "Expiration date must be in the future." }, { status: 400 });
  }

  const codeHash = createHash("sha256")
    .update(code.trim().toLowerCase())
    .digest("hex");

  // Cancel any existing active reservation for this product
  await supabaseAdmin
    .from("product_reservations")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("product_id", productId)
    .is("cancelled_at", null);

  // Create new reservation
  const { data: reservation, error: insertError } = await supabaseAdmin
    .from("product_reservations")
    .insert({
      product_id: productId,
      reservation_code_hash: codeHash,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_note: customerNote || null,
      deposit_amount_usd: depositAmountUsd ?? 0,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update product status
  const { error: updateError } = await supabaseAdmin
    .from("products")
    .update({
      status: "reserved",
      reserved_until: expiresAt,
      reserved_for_handle: customerName || null,
    })
    .eq("id", productId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ reservationId: reservation.id });
}
