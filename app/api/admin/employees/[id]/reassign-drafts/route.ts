/**
 * POST /api/admin/employees/[id]/reassign-drafts
 *
 * Reassigns every unfinished listing (EMPLOYEE_DRAFT or NEEDS_ADJUSTMENT)
 * currently owned by employee [id] to a different catalog-contributor
 * employee — used when an account is suspended/terminated and someone else
 * needs to pick up their in-progress work. Only touches listings that
 * haven't been submitted for review; anything already AWAITING_APPROVAL or
 * further along keeps its original attribution (submission history is
 * immutable regardless of reassignment).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: fromEmployeeId } = await params;

  let body: { toEmployeeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.toEmployeeId) return NextResponse.json({ error: "toEmployeeId is required." }, { status: 400 });

  const { data: target } = await supabaseAdmin
    .from("approved_users")
    .select("id, role")
    .eq("id", body.toEmployeeId)
    .maybeSingle();
  if (!target || target.role !== "catalog_contributor") {
    return NextResponse.json({ error: "toEmployeeId must be an active catalog contributor." }, { status: 400 });
  }

  const { data: reassigned, error } = await supabaseAdmin
    .from("products")
    .update({ created_by_employee_id: body.toEmployeeId })
    .eq("created_by_employee_id", fromEmployeeId)
    .in("listing_status", ["EMPLOYEE_DRAFT", "NEEDS_ADJUSTMENT"])
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorUserId: "admin",
    action: "reassign_drafts",
    entityType: "approved_user",
    entityId: fromEmployeeId,
    newValue: { toEmployeeId: body.toEmployeeId, productIds: (reassigned ?? []).map((r) => r.id) },
  });

  return NextResponse.json({ reassignedCount: reassigned?.length ?? 0 });
}
