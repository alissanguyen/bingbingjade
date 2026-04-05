import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// POST /api/admin/sourcing/[id]/close
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const now = new Date().toISOString();

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, sourcing_status")
    .eq("id", id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (["fulfilled", "cancelled"].includes(req.sourcing_status)) {
    return NextResponse.json({ error: "Request already closed." }, { status: 400 });
  }

  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "closed", updated_at: now })
    .eq("id", id);

  // Close any open attempts
  await supabaseAdmin
    .from("sourcing_attempts")
    .update({ status: "closed", updated_at: now })
    .eq("sourcing_request_id", id)
    .in("status", ["draft", "sent"]);

  return NextResponse.json({ ok: true });
}
