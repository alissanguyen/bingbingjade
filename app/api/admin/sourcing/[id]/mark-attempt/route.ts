import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

const RESPONSE_WINDOW_HOURS = 72;
const FINAL_CREDIT_WINDOW_DAYS = 7;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { isFinal?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data: req_ } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, payment_status, sourcing_status")
    .eq("id", id)
    .maybeSingle();

  if (!req_) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (req_.payment_status !== "paid")
    return NextResponse.json({ error: "Deposit not yet paid." }, { status: 400 });

  const now = new Date();
  const responseWindowMs = RESPONSE_WINDOW_HOURS * 60 * 60 * 1000;

  const updates: Record<string, unknown> = {
    sourcing_status:               "options_sent",
    last_attempt_sent_at:          now.toISOString(),
    last_attempt_response_due_at:  new Date(now.getTime() + responseWindowMs).toISOString(),
    updated_at:                    now.toISOString(),
  };

  if (body.isFinal) {
    const creditWindowMs = FINAL_CREDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    updates.final_attempt_sent_at = now.toISOString();
    updates.credit_expires_at     = new Date(now.getTime() + creditWindowMs).toISOString();
  }

  const { error } = await supabaseAdmin
    .from("sourcing_requests")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[admin/sourcing/mark-attempt]", error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
