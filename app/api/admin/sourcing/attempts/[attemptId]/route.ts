import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// DELETE — discard a draft attempt (and all its options)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { attemptId } = await params;

  const { data: attempt } = await supabaseAdmin
    .from("sourcing_attempts")
    .select("id, status, sourcing_request_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }
  if (attempt.status !== "draft") {
    return NextResponse.json({ error: "Only draft attempts can be discarded." }, { status: 400 });
  }

  // Delete options first (cascade not guaranteed)
  await supabaseAdmin
    .from("sourcing_attempt_options")
    .delete()
    .eq("attempt_id", attemptId);

  const { error: delErr } = await supabaseAdmin
    .from("sourcing_attempts")
    .delete()
    .eq("id", attemptId);

  if (delErr) {
    return NextResponse.json({ error: "Failed to discard attempt." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
