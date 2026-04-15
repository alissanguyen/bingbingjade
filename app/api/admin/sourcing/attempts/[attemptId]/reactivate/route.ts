import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { ATTEMPT_RESPONSE_HOURS } from "@/lib/sourcing-workflow";

export const dynamic = "force-dynamic";

// POST — admin reactivates a past round so customer can respond again
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { attemptId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, sourcing_request_id, attempt_number, status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (!["expired", "skipped", "responded"].includes(attempt.status)) {
    return NextResponse.json({ error: "Only expired, skipped or responded rounds can be reactivated." }, { status: 400 });
  }

  const now = new Date();
  const responseDueAt = new Date(now.getTime() + ATTEMPT_RESPONSE_HOURS * 60 * 60 * 1000);
  const nowStr = now.toISOString();

  // Restore options
  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "active", updated_at: nowStr })
    .eq("attempt_id", attemptId)
    .in("status", ["skipped", "expired", "responded"]);

  // Revert converted_to_checkout option too (if customer had previously accepted)
  const { data: pendingOffer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, sourcing_attempt_option_id")
    .eq("sourcing_attempt_id", attemptId)
    .eq("status", "pending_checkout")
    .maybeSingle();

  if (pendingOffer) {
    if (pendingOffer.sourcing_attempt_option_id) {
      await supabaseAdmin
        .from("sourcing_attempt_options")
        .update({ status: "active", updated_at: nowStr })
        .eq("id", pendingOffer.sourcing_attempt_option_id);
    }
    await supabaseAdmin
      .from("sourcing_checkout_offers")
      .update({ status: "expired", updated_at: nowStr })
      .eq("id", pendingOffer.id);
  }

  // Update attempt
  await supabaseAdmin
    .from("sourcing_attempts")
    .update({
      status: "sent",
      response_due_at: responseDueAt.toISOString(),
      updated_at: nowStr,
    })
    .eq("id", attemptId);

  // Update request
  await supabaseAdmin
    .from("sourcing_requests")
    .update({
      sourcing_status: "awaiting_response",
      credit_expires_at: responseDueAt.toISOString(),
      last_attempt_response_due_at: responseDueAt.toISOString(),
      updated_at: nowStr,
    })
    .eq("id", attempt.sourcing_request_id);

  return NextResponse.json({ ok: true, responseDueAt: responseDueAt.toISOString() });
}
