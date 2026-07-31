import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendServiceStatusEmail } from "@/lib/service-emails";
import { logAudit } from "@/lib/audit";

const ALLOWED_TRANSITIONS = ["received", "in_progress", "quality_control", "ready_to_return", "shipped_back", "completed", "cancelled"] as const;
type AllowedStatus = (typeof ALLOWED_TRANSITIONS)[number];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; trackingNumber?: string; carrier?: string; returnTrackingNumber?: string; returnCarrier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.status || !ALLOWED_TRANSITIONS.includes(body.status as AllowedStatus)) {
    return NextResponse.json({ error: `Status must be one of: ${ALLOWED_TRANSITIONS.join(", ")}.` }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("service_requests").select("status").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  const patch: Record<string, string> = { status: body.status };
  if (body.trackingNumber) patch.tracking_number = body.trackingNumber.trim();
  if (body.carrier) patch.carrier = body.carrier.trim();
  if (body.returnTrackingNumber) patch.return_tracking_number = body.returnTrackingNumber.trim();
  if (body.returnCarrier) patch.return_carrier = body.returnCarrier.trim();

  const { data: updated, error } = await supabaseAdmin
    .from("service_requests")
    .update(patch)
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ error: "Failed to update status." }, { status: 500 });

  await logAudit({
    actorUserId: "admin",
    action: "status_changed",
    entityType: "service_request",
    entityId: id,
    previousValue: { status: existing.status },
    newValue: { status: body.status },
  });

  if (body.status in { received: 1, in_progress: 1, quality_control: 1, ready_to_return: 1, shipped_back: 1, completed: 1 }) {
    await sendServiceStatusEmail({
      serviceRequest: updated,
      service: updated.service,
      status: body.status as "received" | "in_progress" | "quality_control" | "ready_to_return" | "shipped_back" | "completed",
    }).catch((e) => console.error("[admin/service-requests/status] email failed", e));
  }

  return NextResponse.json({ serviceRequest: updated });
}
