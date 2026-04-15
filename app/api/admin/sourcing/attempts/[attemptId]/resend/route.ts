import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { sendAttemptEmail } from "@/lib/sourcing-emails";

export const dynamic = "force-dynamic";

// POST — resend the notification email for a specific round
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
      id, attempt_number, status, response_due_at,
      sourcing_request_id,
      sourcing_attempt_options (id, status)
    `)
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("customer_name, customer_email, public_token, max_attempts")
    .eq("id", attempt.sourcing_request_id)
    .maybeSingle();

  if (!req || !req.public_token) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const optionCount = ((attempt.sourcing_attempt_options ?? []) as { status: string }[])
    .filter((o) => ["active", "responded", "skipped"].includes(o.status)).length;

  await sendAttemptEmail({
    customerName:  req.customer_name,
    customerEmail: req.customer_email,
    publicToken:   req.public_token,
    attemptNumber: attempt.attempt_number,
    maxAttempts:   req.max_attempts,
    responseDueAt: attempt.response_due_at ?? new Date(Date.now() + 72 * 3600_000).toISOString(),
    optionCount,
  });

  return NextResponse.json({ ok: true });
}
