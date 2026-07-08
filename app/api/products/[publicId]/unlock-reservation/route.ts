import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHash } from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;

  let code: string;
  try {
    ({ code } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, status, reserved_until")
    .eq("public_id", publicId)
    .single();

  if (!product || product.status !== "reserved") {
    return NextResponse.json({ error: "This piece is not currently reserved." }, { status: 400 });
  }

  if (product.reserved_until && new Date(product.reserved_until) <= new Date()) {
    return NextResponse.json({ error: "This reservation has expired." }, { status: 400 });
  }

  const codeHash = createHash("sha256")
    .update(code.trim().toLowerCase())
    .digest("hex");

  const { data: reservation } = await supabaseAdmin
    .from("product_reservations")
    .select("id, deposit_paid, deposit_amount_usd")
    .eq("product_id", product.id)
    .eq("reservation_code_hash", codeHash)
    .is("cancelled_at", null)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Incorrect reservation code." }, { status: 403 });
  }

  return NextResponse.json({
    reservationId: reservation.id,
    depositPaid: reservation.deposit_paid,
    depositAmountUsd: reservation.deposit_paid ? Number(reservation.deposit_amount_usd ?? 0) : 0,
  });
}
