import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { listAttachments, getServiceRequestTimeline } from "@/lib/service-requests";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: serviceRequest, error } = await supabaseAdmin
    .from("service_requests")
    .select("*, service:services(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !serviceRequest) {
    return NextResponse.json({ error: "Service request not found." }, { status: 404 });
  }

  const [attachments, timeline] = await Promise.all([listAttachments(id), getServiceRequestTimeline(id)]);

  return NextResponse.json({ serviceRequest, attachments, timeline });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { assignedStaff?: string; adminNotes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (typeof body.assignedStaff === "string") patch.assigned_staff = body.assignedStaff;
  if (typeof body.adminNotes === "string") patch.admin_notes = body.adminNotes;

  const { data: updated, error } = await supabaseAdmin
    .from("service_requests")
    .update(patch)
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ error: "Failed to update request." }, { status: 500 });
  return NextResponse.json({ serviceRequest: updated });
}
