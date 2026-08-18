import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET — claims summary for the Claims/Returns section embedded in
// /orders-admin/[id] (§40).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: claims } = await supabaseAdmin
    .from("claims")
    .select("id, claim_number, claim_type, status, responsibility, assigned_admin, next_action, opened_at, closed_at")
    .eq("order_id", id)
    .order("opened_at", { ascending: false });

  return NextResponse.json({ claims: claims ?? [] });
}
