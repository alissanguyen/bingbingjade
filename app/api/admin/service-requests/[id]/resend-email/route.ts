import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  sendServiceRequestReceivedEmail,
  sendMoreImagesRequestedEmail,
  sendQuoteReadyEmail,
  sendShippingInstructionsEmail,
  sendServiceStatusEmail,
} from "@/lib/service-emails";
import { logAudit } from "@/lib/audit";

const STATUS_EMAIL_KEYS = ["received", "in_progress", "quality_control", "ready_to_return", "shipped_back", "completed"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { template?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: request } = await supabaseAdmin.from("service_requests").select("*, service:services(*)").eq("id", id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  try {
    switch (body.template) {
      case "request_received": {
        const mode = request.service.workflow_mode as "instant_purchase" | "authorization_hold" | "quote_required";
        await sendServiceRequestReceivedEmail({ serviceRequest: request, service: request.service, mode });
        break;
      }
      case "more_images":
        if (!request.admin_instructions) return NextResponse.json({ error: "No saved image-request instructions to resend." }, { status: 400 });
        await sendMoreImagesRequestedEmail({ serviceRequest: request, service: request.service, instructions: request.admin_instructions });
        break;
      case "quote_ready":
        if (!request.quote_amount_cents) return NextResponse.json({ error: "No quote to resend." }, { status: 400 });
        await sendQuoteReadyEmail({ serviceRequest: request, service: request.service });
        break;
      case "shipping_instructions":
        await sendShippingInstructionsEmail({ serviceRequest: request, service: request.service });
        break;
      default:
        if (STATUS_EMAIL_KEYS.includes(body.template as (typeof STATUS_EMAIL_KEYS)[number])) {
          await sendServiceStatusEmail({ serviceRequest: request, service: request.service, status: body.template as (typeof STATUS_EMAIL_KEYS)[number] });
          break;
        }
        return NextResponse.json({ error: "Unknown email template." }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/service-requests/resend-email] Failed:", err);
    return NextResponse.json({ error: "Failed to resend email." }, { status: 500 });
  }

  await logAudit({
    actorUserId: "admin",
    action: "email_resent",
    entityType: "service_request",
    entityId: id,
    metadata: { template: body.template },
  });

  return NextResponse.json({ sent: true });
}
