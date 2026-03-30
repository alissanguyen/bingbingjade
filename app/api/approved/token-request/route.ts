import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isApproved } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/approved/token-request
// Body: { message?: string; requested_amount?: number }
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isApproved(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session as Extract<typeof session, { type: "approved" }>).user.id;

  let body: { message?: string; requested_amount?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const requestedAmount = Math.min(Math.max(Number(body.requested_amount) || 10, 1), 100);

  // Only allow one pending request at a time
  const { data: existing } = await supabaseAdmin
    .from("token_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending token request. Please wait for admin to respond." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from("token_requests").insert({
    user_id: userId,
    message: body.message?.trim() || null,
    requested_amount: requestedAmount,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
