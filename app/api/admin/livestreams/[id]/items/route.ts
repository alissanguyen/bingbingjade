import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

// Appends items to an existing livestream (draft or live) — for pieces added
// on the fly when a viewer asks about something that wasn't planned.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { count?: number; title?: string; size?: string; price?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const count = Math.floor(Number(body.count ?? 1));
  if (!Number.isFinite(count) || count < 1 || count > 50)
    return NextResponse.json({ error: "count must be 1–50" }, { status: 400 });
  const price = body.price != null ? Number(body.price) : 0;
  if (!Number.isFinite(price) || price < 0)
    return NextResponse.json({ error: "price must be ≥ 0" }, { status: 400 });

  const { data: ls } = await supabaseAdmin
    .from("livestreams")
    .select("id, code_prefix, status")
    .eq("id", id)
    .maybeSingle();
  if (!ls) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ls.status === "ended")
    return NextResponse.json({ error: "Livestream has ended" }, { status: 409 });

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("livestream_items")
    .select("code, display_order")
    .eq("livestream_id", id);
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  // Continue numbering after the highest existing code (TEO40 → TEO41)
  const prefix = ls.code_prefix;
  const codeRe = new RegExp(`^${prefix}(\\d+)$`);
  let maxNum = 0;
  let maxOrder = 0;
  for (const row of existing ?? []) {
    const m = codeRe.exec(row.code);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
    maxOrder = Math.max(maxOrder, row.display_order ?? 0);
  }

  const items = Array.from({ length: count }, (_, i) => {
    const code = `${prefix}${maxNum + i + 1}`;
    return {
      livestream_id: id,
      code,
      display_order: maxOrder + i + 1,
      title_snapshot: (count === 1 && body.title?.trim()) || `Item ${code}`,
      size: (count === 1 && body.size?.trim()) || null,
      price,
      status: "available",
    };
  });

  const { data: inserted, error } = await supabaseAdmin
    .from("livestream_items")
    .insert(items)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from("livestreams")
    .update({ item_count: (existing?.length ?? 0) + count, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ items: inserted }, { status: 201 });
}
