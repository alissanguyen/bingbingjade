import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendMoreImagesRequestedEmail } from "@/lib/service-emails";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { instructions?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.instructions?.trim()) {
    return NextResponse.json({ error: "Please describe what additional photos you need." }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("service_requests")
    .update({ status: "awaiting_images", admin_instructions: body.instructions.trim() })
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  await logAudit({
    actorUserId: "admin",
    action: "more_images_requested",
    entityType: "service_request",
    entityId: id,
    newValue: { status: "awaiting_images", instructions: body.instructions.trim() },
  });

  await sendMoreImagesRequestedEmail({ serviceRequest: updated, service: updated.service, instructions: body.instructions.trim() }).catch((e) =>
    console.error("[admin/service-requests/request-images] email failed", e)
  );

  return NextResponse.json({ serviceRequest: updated });
}
