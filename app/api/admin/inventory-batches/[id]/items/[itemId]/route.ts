import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("assigned_inventory_cost_usd" in body) update.assigned_inventory_cost_usd = Number(body.assigned_inventory_cost_usd ?? 0);
  if ("item_expense_usd"             in body) update.item_expense_usd            = Number(body.item_expense_usd ?? 0);
  if ("allocation_method"            in body) update.allocation_method           = body.allocation_method || "manual";
  if ("notes"                        in body) update.notes                       = (body.notes as string | undefined)?.trim() || null;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No fields to update." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("inventory_batch_items")
    .update(update)
    .eq("id", itemId)
    .select("id, product_id, assigned_inventory_cost_usd, item_expense_usd, allocation_method, notes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const { error } = await supabaseAdmin.from("inventory_batch_items").delete().eq("id", itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
