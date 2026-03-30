import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/admin/token-requests/[id]
// Body: { action: "approve" | "deny"; granted_amount?: number; admin_note?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: "approve" | "deny"; granted_amount?: number; admin_note?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  const { data: tokenReq } = await supabaseAdmin
    .from("token_requests")
    .select("id, user_id, requested_amount, status")
    .eq("id", id)
    .single();

  if (!tokenReq) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (tokenReq.status !== "pending") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  const adminNote = body.admin_note?.trim() || null;

  if (body.action === "approve") {
    const grantedAmount = Math.max(Number(body.granted_amount) || tokenReq.requested_amount, 1);

    // Credit tokens to the user
    const { data: userRow } = await supabaseAdmin
      .from("approved_users")
      .select("generation_tokens")
      .eq("id", tokenReq.user_id)
      .single();

    if (userRow) {
      await supabaseAdmin
        .from("approved_users")
        .update({ generation_tokens: userRow.generation_tokens + grantedAmount })
        .eq("id", tokenReq.user_id);
    }

    await supabaseAdmin
      .from("token_requests")
      .update({
        status: "approved",
        granted_amount: grantedAmount,
        admin_note: adminNote,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
  } else {
    await supabaseAdmin
      .from("token_requests")
      .update({
        status: "denied",
        admin_note: adminNote,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
