import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";

export async function POST(req: NextRequest) {
  let body: { sourcingRequestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = typeof body.sourcingRequestId === "string" ? body.sourcingRequestId.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Please provide a sourcing request ID." }, { status: 400 });
  }

  const { data: req_ } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, payment_status, deposit_amount_cents, credit_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!req_ || req_.payment_status !== "paid") {
    return NextResponse.json({ error: "Sourcing credit not found or not yet paid." }, { status: 404 });
  }

  if (req_.credit_expires_at && new Date(req_.credit_expires_at as string) < new Date()) {
    return NextResponse.json({ error: "This sourcing credit has expired." }, { status: 400 });
  }

  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", id);

  const availableCents = computeAvailableCredit(
    req_.deposit_amount_cents as number,
    (ledger ?? []) as LedgerRow[]
  );

  if (availableCents <= 0) {
    return NextResponse.json({ error: "No remaining credit on this sourcing request." }, { status: 400 });
  }

  return NextResponse.json({ availableCents, depositCents: req_.deposit_amount_cents });
}
