import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: batch, error }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("inventory_batches")
      .select("*")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("inventory_batch_items")
      .select("id, product_id, assigned_inventory_cost_usd, allocation_method, notes, created_at, products(id, name, images)")
      .eq("batch_id", id)
      .order("created_at"),
  ]);

  if (error || !batch) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ batch, items: items ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const allowed = [
    "name", "batch_code", "vendor", "purchase_date", "received_date", "status",
    "goods_cost_usd", "freight_cost_usd", "insurance_cost_usd", "duties_cost_usd",
    "certification_cost_usd", "misc_cost_usd", "notes",
    "partner_payment_usd", "payment_to_partner_usd",
  ];

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      update[key] = typeof val === "string" ? (val.trim() || null) : val;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("inventory_batches")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from("inventory_batches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
