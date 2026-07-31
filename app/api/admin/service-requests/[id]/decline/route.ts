import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { releaseServiceRequestAuthorization, ConflictError, ValidationError } from "@/lib/service-requests";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* reason is optional */
  }

  const { data: request } = await supabaseAdmin.from("service_requests").select("id, capture_status").eq("id", id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  if (request.capture_status) {
    try {
      const serviceRequest = await releaseServiceRequestAuthorization(id, "admin", body.reason);
      return NextResponse.json({ serviceRequest });
    } catch (err) {
      if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
      console.error("[admin/service-requests/decline] Release failed:", err);
      return NextResponse.json({ error: "Failed to decline request." }, { status: 500 });
    }
  }

  // No payment was ever taken (quote flow before checkout) — just mark rejected.
  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({ status: "rejected", decline_reason: body.reason ?? "Declined after image review", decided_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  await logAudit({
    actorUserId: "admin",
    action: "service_request_declined",
    entityType: "service_request",
    entityId: id,
    newValue: { status: "rejected", decline_reason: body.reason ?? null },
  });

  return NextResponse.json({ serviceRequest: updated });
}
