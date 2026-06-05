import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// POST { from: string, into: string }
// Rewrites all expenses that use `from` to use `into`, then removes `from`.
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { from, into } = await req.json() as { from?: string; into?: string };
  if (!from?.trim() || !into?.trim()) return NextResponse.json({ error: "from and into are required" }, { status: 400 });
  if (from.trim() === into.trim()) return NextResponse.json({ error: "from and into must be different" }, { status: 400 });

  const { error: updateErr } = await supabaseAdmin
    .from("business_expenses")
    .update({ vendor: into.trim() })
    .eq("vendor", from.trim());
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await supabaseAdmin.from("expense_vendors").delete().eq("name", from.trim());

  return NextResponse.json({ ok: true });
}

// DELETE ?name=X  — remove a vendor from the list without touching expenses
export async function DELETE(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await supabaseAdmin.from("expense_vendors").delete().eq("name", name);
  return NextResponse.json({ ok: true });
}
