import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { ATTEMPT_RESPONSE_HOURS } from "@/lib/sourcing-workflow";
import { sendAttemptEmail } from "@/lib/sourcing-emails";

export const dynamic = "force-dynamic";

// POST /api/admin/sourcing/attempts/[attemptId]/send
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { attemptId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select(`
      id, sourcing_request_id, attempt_number, status,
      sourcing_attempt_options (id, status)
    `)
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "draft") {
    return NextResponse.json({ error: "Only draft attempts can be sent." }, { status: 400 });
  }

  const activeOptions = (attempt.sourcing_attempt_options ?? []).filter(
    (o: { status: string }) => !["expired", "rejected"].includes(o.status)
  );
  if (activeOptions.length === 0) {
    return NextResponse.json({ error: "Add at least one option before sending." }, { status: 400 });
  }

  // Fetch request info for email
  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("customer_name, customer_email, public_token, max_attempts, attempts_used, sourcing_status")
    .eq("id", attempt.sourcing_request_id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "Sourcing request not found." }, { status: 404 });
  if (!req.public_token) return NextResponse.json({ error: "Request missing public_token. Run migration_046 first." }, { status: 500 });

  const now = new Date();
  const responseDueAt = new Date(now.getTime() + ATTEMPT_RESPONSE_HOURS * 60 * 60 * 1000);

  // Mark all draft options as active
  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "active", updated_at: now.toISOString() })
    .eq("attempt_id", attemptId)
    .eq("status", "draft");

  // Update attempt to sent
  await supabaseAdmin
    .from("sourcing_attempts")
    .update({
      status:          "sent",
      sent_at:         now.toISOString(),
      response_due_at: responseDueAt.toISOString(),
      updated_at:      now.toISOString(),
    })
    .eq("id", attemptId);

  // Increment attempts_used on request and update status.
  // credit_expires_at is set to response_due_at so the deposit credit is only
  // usable while the customer can still accept an option in this round.
  const newAttemptsUsed = (req.attempts_used ?? 0) + 1;
  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      sourcing_status:               "awaiting_response",
      attempts_used:                 newAttemptsUsed,
      credit_expires_at:             responseDueAt.toISOString(),
      last_attempt_sent_at:          now.toISOString(),
      last_attempt_response_due_at:  responseDueAt.toISOString(),
      updated_at:                    now.toISOString(),
    })
    .eq("id", attempt.sourcing_request_id);

  // Send email to customer
  await sendAttemptEmail({
    customerName:    req.customer_name,
    customerEmail:   req.customer_email,
    publicToken:     req.public_token,
    attemptNumber:   attempt.attempt_number,
    maxAttempts:     req.max_attempts,
    responseDueAt:   responseDueAt.toISOString(),
    optionCount:     activeOptions.length,
  });

  return NextResponse.json({ ok: true, responseDueAt: responseDueAt.toISOString() });
}
