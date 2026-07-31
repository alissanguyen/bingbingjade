import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { captureServiceRequestPayment, ConflictError, ValidationError } from "@/lib/service-requests";

/**
 * "Approve" for an authorization_hold request captures the held payment.
 * For a quote_required request (already paid via accept-quote), this just
 * moves it forward in the fulfillment lifecycle since payment already happened.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: request } = await supabaseAdmin.from("service_requests").select("id, capture_status, status").eq("id", id).maybeSingle();
  if (!request) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  if (request.capture_status) {
    try {
      const { serviceRequest, alreadyCaptured } = await captureServiceRequestPayment(id, "admin");
      return NextResponse.json({ serviceRequest, alreadyCaptured });
    } catch (err) {
      if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
      console.error("[admin/service-requests/approve] Capture failed:", err);
      return NextResponse.json({ error: "Failed to capture payment." }, { status: 500 });
    }
  }

  // Quote flow: already captured at accept-quote time — just mark approved.
  const { data: updated } = await supabaseAdmin
    .from("service_requests")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  return NextResponse.json({ serviceRequest: updated });
}
