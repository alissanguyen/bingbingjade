import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { MAX_ATTEMPTS_BY_TYPE } from "@/lib/sourcing-workflow";
import type { RequestType } from "@/lib/sourcing-classification";

export const dynamic = "force-dynamic";

// POST /api/admin/sourcing/[id]/attempts — create a new draft attempt
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const { data: req, error: fetchErr } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, request_type, payment_status, sourcing_status, max_attempts, attempts_used")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !req) {
    return NextResponse.json({ error: "Sourcing request not found." }, { status: 404 });
  }
  if (req.payment_status !== "paid") {
    return NextResponse.json({ error: "Deposit not yet paid." }, { status: 400 });
  }
  if (["fulfilled", "cancelled", "closed"].includes(req.sourcing_status)) {
    return NextResponse.json({ error: "Request is already closed." }, { status: 400 });
  }

  const maxAttempts = req.max_attempts ?? MAX_ATTEMPTS_BY_TYPE[req.request_type as RequestType] ?? 2;
  if ((req.attempts_used ?? 0) >= maxAttempts) {
    return NextResponse.json({ error: "Maximum attempts already reached." }, { status: 400 });
  }

  // Prevent creating a new draft if one already exists or is currently sent
  const { data: existing } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, status")
    .eq("sourcing_request_id", id)
    .in("status", ["draft", "sent"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: `An attempt is already ${existing.status}. Complete or expire it first.`,
    }, { status: 409 });
  }

  // Count all non-cancelled attempts to determine the next attempt_number
  const { count } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id", { count: "exact", head: true })
    .eq("sourcing_request_id", id);

  const attemptNumber = (count ?? 0) + 1;

  const { data: attempt, error: insertErr } = await supabaseAdmin
    .from("sourcing_attempts")
    .insert({
      sourcing_request_id: id,
      attempt_number:      attemptNumber,
      status:              "draft",
    })
    .select("id, attempt_number, status, created_at")
    .single();

  if (insertErr || !attempt) {
    console.error("[attempts] Insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to create attempt." }, { status: 500 });
  }

  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sourcing_status", "queued");

  return NextResponse.json({ attempt });
}
