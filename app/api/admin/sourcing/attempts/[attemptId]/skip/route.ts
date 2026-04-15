import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// POST — admin marks a round as skipped (customer did not respond/choose)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { attemptId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, sourcing_request_id, status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (!["sent", "responded"].includes(attempt.status)) {
    return NextResponse.json({ error: "Only sent or responded rounds can be skipped." }, { status: 400 });
  }

  const now = new Date().toISOString();

  await supabaseAdmin
    .from("sourcing_attempts")
    .update({ status: "skipped", updated_at: now })
    .eq("id", attemptId);

  await supabaseAdmin
    .from("sourcing_attempt_options")
    .update({ status: "skipped", updated_at: now })
    .eq("attempt_id", attemptId)
    .in("status", ["active", "responded"]);

  // Revert request to in_progress if it was awaiting
  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "in_progress", updated_at: now })
    .eq("id", attempt.sourcing_request_id)
    .eq("sourcing_status", "awaiting_response");

  return NextResponse.json({ ok: true });
}
