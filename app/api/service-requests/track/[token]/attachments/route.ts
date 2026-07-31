import { NextRequest, NextResponse } from "next/server";
import { addAttachment, getServiceRequestByToken, resolveAttachmentForResponse, ValidationError } from "@/lib/service-requests";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const serviceRequest = await getServiceRequestByToken(token);
  if (!serviceRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const attachment = await addAttachment({
      serviceRequestId: serviceRequest.id,
      file,
      uploadedBy: "customer",
      requireToken: token,
    });
    return NextResponse.json({ attachment: await resolveAttachmentForResponse(attachment) });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[service-requests/track/attachments] Upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

/**
 * Once the customer has uploaded requested photos, return the request to
 * Pending Review (per spec: admin shouldn't need a separate "resubmit" step).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const serviceRequest = await getServiceRequestByToken(token);
  if (!serviceRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (serviceRequest.status !== "awaiting_images") {
    return NextResponse.json({ status: serviceRequest.status });
  }

  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({ status: "pending_review" })
    .eq("id", serviceRequest.id)
    .eq("status", "awaiting_images")
    .select("status")
    .maybeSingle();

  if (updated) {
    await logAudit({
      actorUserId: "customer",
      action: "additional_images_submitted",
      entityType: "service_request",
      entityId: serviceRequest.id,
      newValue: { status: "pending_review" },
    });
  }

  return NextResponse.json({ status: updated?.status ?? serviceRequest.status });
}
