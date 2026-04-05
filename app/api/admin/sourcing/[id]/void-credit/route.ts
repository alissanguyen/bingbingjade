import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { getAvailableCredit } from "@/lib/sourcing-workflow";

export const dynamic = "force-dynamic";

// POST /api/admin/sourcing/[id]/void-credit
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const now = new Date().toISOString();

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, customer_email, user_id, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (req.payment_status !== "paid") {
    return NextResponse.json({ error: "No paid credit to void." }, { status: 400 });
  }

  const { availableCents } = await getAvailableCredit(id);
  if (availableCents <= 0) {
    return NextResponse.json({ error: "No remaining credit to void." }, { status: 400 });
  }

  await supabaseAdmin.from("sourcing_credit_ledger").insert({
    sourcing_request_id: id,
    customer_email:      req.customer_email,
    user_id:             req.user_id ?? null,
    event_type:          "credit_voided",
    amount_cents:        availableCents,
    currency:            "usd",
    notes:               `Admin voided $${(availableCents / 100).toFixed(2)} of remaining credit`,
  });

  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      sourcing_status: "cancelled",
      credit_expires_at: now,
      updated_at: now,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, voidedCents: availableCents });
}
