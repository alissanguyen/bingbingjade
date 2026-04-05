import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// POST /api/sourcing/request/[token]/feedback
// Body: { attemptId, optionReactions: [{optionId, reaction, note}], generalFeedback? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Resolve request by token
  const { data: sourcingReq } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, sourcing_status")
    .eq("public_token", token)
    .maybeSingle();

  if (!sourcingReq) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const attemptId = typeof body.attemptId === "string" ? body.attemptId : null;
  if (!attemptId) return NextResponse.json({ error: "attemptId required." }, { status: 400 });

  // Verify attempt belongs to this request and is still sent (not expired)
  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, status, response_due_at")
    .eq("id", attemptId)
    .eq("sourcing_request_id", sourcingReq.id)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "sent" && attempt.status !== "responded") {
    return NextResponse.json({ error: "This round is no longer open for feedback." }, { status: 400 });
  }
  if (attempt.response_due_at && new Date(attempt.response_due_at) < new Date()) {
    return NextResponse.json({ error: "The response window has closed." }, { status: 400 });
  }

  // Apply per-option reactions
  const reactions = Array.isArray(body.optionReactions) ? body.optionReactions : [];
  const VALID_REACTIONS = ["liked", "disliked", "neutral"];
  const now = new Date().toISOString();

  for (const r of reactions) {
    if (typeof r !== "object" || !r) continue;
    const rec = r as Record<string, unknown>;
    const optionId = typeof rec.optionId === "string" ? rec.optionId : null;
    const reaction = typeof rec.reaction === "string" && VALID_REACTIONS.includes(rec.reaction)
      ? rec.reaction : null;
    const note = typeof rec.note === "string" ? rec.note.slice(0, 1000) : null;

    if (!optionId) continue;

    await supabaseAdmin
      .from("sourcing_attempt_options")
      .update({
        customer_reaction: reaction,
        customer_note:     note,
        updated_at:        now,
      })
      .eq("id", optionId)
      .eq("attempt_id", attemptId);
  }

  // Save general feedback on attempt
  const generalFeedback = typeof body.generalFeedback === "string"
    ? body.generalFeedback.slice(0, 3000).trim()
    : null;

  await supabaseAdmin
    .from("sourcing_attempts")
    .update({
      status:           "responded",
      responded_at:     now,
      customer_feedback: generalFeedback,
      updated_at:       now,
    })
    .eq("id", attemptId);

  // Update request status
  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "responded", updated_at: now })
    .eq("id", sourcingReq.id)
    .eq("sourcing_status", "awaiting_response");

  return NextResponse.json({ ok: true });
}
