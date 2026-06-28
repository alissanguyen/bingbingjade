import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("livestreams")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ livestreams: data });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    platform?: string;
    scheduled_at?: string | null;
    code_prefix?: string;
    item_count?: number;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { title, platform = "instagram", scheduled_at, code_prefix = "A", item_count = 10, notes } = body;
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!item_count || item_count < 1 || item_count > 200)
    return NextResponse.json({ error: "item_count must be 1–200" }, { status: 400 });

  const prefix = (code_prefix ?? "A").toUpperCase().replace(/[^A-Z]/g, "") || "A";

  // Create the livestream
  const { data: ls, error: lsErr } = await supabaseAdmin
    .from("livestreams")
    .insert({
      title: title.trim(),
      platform,
      scheduled_at: scheduled_at ?? null,
      code_prefix: prefix,
      item_count,
      notes: notes ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (lsErr) return NextResponse.json({ error: lsErr.message }, { status: 500 });

  // Auto-generate items with codes like A1, A2, …
  const items = Array.from({ length: item_count }, (_, i) => ({
    livestream_id: ls.id,
    code: `${prefix}${i + 1}`,
    display_order: i + 1,
    title_snapshot: `Item ${prefix}${i + 1}`,
    price: 0,
    status: "available",
  }));

  const { error: itemsErr } = await supabaseAdmin.from("livestream_items").insert(items);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  return NextResponse.json({ livestream: ls }, { status: 201 });
}
