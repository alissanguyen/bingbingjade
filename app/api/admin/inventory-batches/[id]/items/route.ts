import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batch_id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("inventory_batch_items")
    .insert({
      batch_id,
      product_id:                   body.product_id || null,
      assigned_inventory_cost_usd:  Number(body.assigned_inventory_cost_usd ?? 0),
      allocation_method:            body.allocation_method || "manual",
      notes:                        (body.notes as string | undefined)?.trim() || null,
    })
    .select("id, product_id, assigned_inventory_cost_usd, allocation_method, notes, created_at, products(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = Array.isArray((data as any).products) ? (data as any).products[0] : (data as any).products;
  return NextResponse.json({
    item: { ...data, productName: product?.name ?? null, productImageUrl: null },
  }, { status: 201 });
}
