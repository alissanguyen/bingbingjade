/**
 * GET  /api/admin/payouts — list payouts (optionally filtered by employeeId)
 * POST /api/admin/payouts — create a payout for a custom period via fn_create_payout
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = req.nextUrl.searchParams.get("employeeId");

  let q = supabaseAdmin
    .from("employee_payouts")
    .select("*, approved_users(id, email, full_name)")
    .order("created_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payouts: data ?? [] });
}

type CreatePayoutBody = {
  employeeId?: string;
  periodStart?: string;
  periodEnd?: string;
  bonusAmount?: number;
  adjustmentAmount?: number;
  deductionAmount?: number;
  paymentMethod?: string;
  scheduledPayDate?: string;
  privateAdminNotes?: string;
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreatePayoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.employeeId || !body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "employeeId, periodStart, and periodEnd are required." }, { status: 400 });
  }

  const { data: payoutId, error } = await supabaseAdmin.rpc("fn_create_payout", {
    p_employee_id: body.employeeId,
    p_period_start: body.periodStart,
    p_period_end: body.periodEnd,
    p_bonus_amount: body.bonusAmount ?? 0,
    p_adjustment_amount: body.adjustmentAmount ?? 0,
    p_deduction_amount: body.deductionAmount ?? 0,
    p_payment_method: body.paymentMethod ?? null,
    p_scheduled_pay_date: body.scheduledPayDate ?? null,
    p_private_admin_notes: body.privateAdminNotes ?? null,
    p_created_by_admin_id: "admin",
  });

  if (error) {
    if (error.message.includes("invalid_period")) {
      return NextResponse.json({ error: "periodEnd must not be before periodStart." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actorUserId: "admin",
    action: "create_payout",
    entityType: "employee_payout",
    entityId: String(payoutId),
    newValue: body,
  });

  return NextResponse.json({ payoutId }, { status: 201 });
}
