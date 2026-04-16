import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/banner — fetch current banner config
export async function GET() {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("site_banners")
    .select("*")
    .eq("id", "main")
    .maybeSingle();

  return NextResponse.json(
    data ?? { id: "main", is_active: false, template: "restock", target_date: null, background: "black" }
  );
}

// POST /api/admin/banner — upsert banner config
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("site_banners")
    .upsert(
      {
        id:          "main",
        is_active:   Boolean(body.is_active),
        template:    typeof body.template === "string" ? body.template : "restock",
        target_date: typeof body.target_date === "string" && body.target_date ? body.target_date : null,
        background:  body.background === "white" ? "white" : "black",
        updated_at:  new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
