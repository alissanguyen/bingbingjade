import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/full-accounting/settings
export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("accounting_settings")
    .select("id, default_supplies_cost_per_order, supplies_estimate_method, updated_at")
    .limit(1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/admin/full-accounting/settings
// Body: { default_supplies_cost_per_order: number }
export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { default_supplies_cost_per_order?: number };
  const newDefault = Number(body.default_supplies_cost_per_order);
  if (!isFinite(newDefault) || newDefault < 0) {
    return NextResponse.json({ error: "Invalid default_supplies_cost_per_order" }, { status: 400 });
  }

  // Fetch the existing row id
  const { data: existing } = await supabaseAdmin
    .from("accounting_settings")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Settings not found — run migration_058" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("accounting_settings")
    .update({
      default_supplies_cost_per_order: newDefault,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
