/**
 * GET   /api/admin/payouts/[payoutId] — payout detail + included items
 * PATCH /api/admin/payouts/[payoutId] — mark paid or cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ payoutId: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payoutId } = await params;

  const [{ data: payout }, { data: items }] = await Promise.all([
    supabaseAdmin.from("employee_payouts").select("*, approved_users(id, email, full_name)").eq("id", payoutId).maybeSingle(),
    supabaseAdmin
      .from("employee_payout_items")
      .select("id, amount, product_id, products(name), approval_credit_id, listing_approval_credits(approved_at, rate_at_approval)")
      .eq("payout_id", payoutId),
  ]);

  if (!payout) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ payout, items: items ?? [] });
}

type PatchBody = {
  action?: "mark_paid" | "cancel";
  actualPaidDate?: string;
  paymentReference?: string;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ payoutId: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payoutId } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "mark_paid") {
    const { error } = await supabaseAdmin.rpc("fn_mark_payout_paid", {
      p_payout_id: payoutId,
      p_actual_paid_date: body.actualPaidDate ?? null,
      p_payment_reference: body.paymentReference ?? null,
    });
    if (error) {
      if (error.message.includes("already_paid")) return NextResponse.json({ error: "This payout is already marked paid." }, { status: 409 });
      if (error.message.includes("payout_cancelled")) return NextResponse.json({ error: "This payout was cancelled." }, { status: 409 });
      if (error.message.includes("payout_not_found")) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAudit({ actorUserId: "admin", action: "mark_payout_paid", entityType: "employee_payout", entityId: payoutId, newValue: body });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancel") {
    const { error } = await supabaseAdmin.rpc("fn_cancel_payout", { p_payout_id: payoutId });
    if (error) {
      if (error.message.includes("cannot_cancel_paid_payout")) {
        return NextResponse.json({ error: "A paid payout can't be cancelled. Add a correction on a future payout instead." }, { status: 409 });
      }
      if (error.message.includes("payout_not_found")) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await logAudit({ actorUserId: "admin", action: "cancel_payout", entityType: "employee_payout", entityId: payoutId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'mark_paid' or 'cancel'." }, { status: 400 });
}
