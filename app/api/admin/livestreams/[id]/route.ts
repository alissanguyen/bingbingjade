import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: ls, error: lsErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabaseAdmin.from("livestreams").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("livestream_items")
      .select("*, product:products(id, name, status, slug), events:livestream_item_events(*)")
      .eq("livestream_id", id)
      .order("display_order"),
  ]);

  if (lsErr || itemsErr)
    return NextResponse.json({ error: (lsErr ?? itemsErr)?.message }, { status: 500 });
  if (!ls) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ livestream: ls, items: items ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const allowed = ["title", "platform", "scheduled_at", "status", "notes"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("livestreams")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ livestream: data });
}
