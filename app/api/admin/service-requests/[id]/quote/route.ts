import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendQuoteReadyEmail } from "@/lib/service-emails";
import { logAudit } from "@/lib/audit";

const DEFAULT_QUOTE_VALIDITY_DAYS = 14;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { amountCents?: number; notes?: string; validityDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "A positive quote amount is required." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("service_requests").select("quote_amount_cents").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Service request not found." }, { status: 404 });

  const validityDays = body.validityDays ?? DEFAULT_QUOTE_VALIDITY_DAYS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from("service_requests")
    .update({
      status: "quote_sent",
      quote_amount_cents: body.amountCents,
      quote_notes: body.notes?.trim() ?? null,
      quote_sent_at: now.toISOString(),
      quote_expires_at: expiresAt,
    })
    .eq("id", id)
    .select("*, service:services(*)")
    .maybeSingle();

  if (error || !updated) return NextResponse.json({ error: "Failed to save quote." }, { status: 500 });

  await logAudit({
    actorUserId: "admin",
    action: existing.quote_amount_cents ? "quote_revised" : "quote_sent",
    entityType: "service_request",
    entityId: id,
    previousValue: existing.quote_amount_cents ? { quote_amount_cents: existing.quote_amount_cents } : undefined,
    newValue: { quote_amount_cents: body.amountCents, quote_expires_at: expiresAt },
  });

  await sendQuoteReadyEmail({ serviceRequest: updated, service: updated.service }).catch((e) => console.error("[admin/service-requests/quote] email failed", e));

  return NextResponse.json({ serviceRequest: updated });
}
