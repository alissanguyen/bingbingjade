import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, customer_email, user_id, payment_status, deposit_amount_cents")
    .eq("id", id)
    .maybeSingle();

  if (!sourcingReq) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (sourcingReq.payment_status !== "paid")
    return NextResponse.json({ error: "Deposit not paid." }, { status: 400 });

  const { data: ledger } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("event_type, amount_cents")
    .eq("sourcing_request_id", id);

  const available = computeAvailableCredit(
    sourcingReq.deposit_amount_cents as number,
    (ledger ?? []) as LedgerRow[]
  );

  if (available <= 0)
    return NextResponse.json({ error: "No remaining credit to expire." }, { status: 400 });

  const now = new Date().toISOString();

  // Insert credit_expired ledger row for the remaining balance
  await supabaseAdmin.from("sourcing_credit_ledger").insert({
    sourcing_request_id: id,
    customer_email:      sourcingReq.customer_email,
    user_id:             sourcingReq.user_id ?? null,
    event_type:          "credit_expired",
    amount_cents:        available,
    currency:            "usd",
    notes:               "Credit expired by admin",
  });

  // Mark the request closed
  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      credit_expires_at: now,
      sourcing_status:   "cancelled",
      updated_at:        now,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, expiredCents: available });
}
