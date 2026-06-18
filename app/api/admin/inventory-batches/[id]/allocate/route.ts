import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/inventory-batches/[id]/allocate
 *
 * Re-calculates and saves assigned_inventory_cost_usd for every item with
 * allocation_method = "proportional".
 *
 * Formula per item:
 *   effective_price = sale_price_usd (if status=on_sale) else price_display_usd
 *   allocated_cost  = (effective_price / sum_of_all_proportional_effective_prices) * total_batch_cost
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: batch } = await supabaseAdmin
    .from("inventory_batches")
    .select("id, total_batch_cost_usd")
    .eq("id", id)
    .single();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const totalBatchCost = Number(batch.total_batch_cost_usd ?? 0);

  const { data: propItems } = await supabaseAdmin
    .from("inventory_batch_items")
    .select("id, product_id")
    .eq("batch_id", id)
    .eq("allocation_method", "proportional")
    .not("product_id", "is", null);

  if (!propItems || propItems.length === 0) {
    return NextResponse.json({ message: "No proportional items found.", items: [] });
  }

  const productIds = propItems.map((i) => i.product_id as string);

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, price_display_usd, sale_price_usd, status")
    .in("id", productIds);

  const priceMap = new Map(
    (products ?? []).map((p) => [
      p.id,
      p.status === "on_sale" && p.sale_price_usd ? Number(p.sale_price_usd) : Number(p.price_display_usd ?? 0),
    ])
  );

  const totalRevenue = propItems.reduce((sum, item) => sum + (priceMap.get(item.product_id!) ?? 0), 0);

  if (totalRevenue === 0) {
    return NextResponse.json(
      { error: "Cannot allocate: all proportional products have $0 price." },
      { status: 400 }
    );
  }

  const updates = propItems.map((item) => {
    const price = priceMap.get(item.product_id!) ?? 0;
    const allocatedCost = Math.round((price / totalRevenue) * totalBatchCost * 100) / 100;
    return { id: item.id, assigned_inventory_cost_usd: allocatedCost };
  });

  await Promise.all(
    updates.map(({ id: itemId, assigned_inventory_cost_usd }) =>
      supabaseAdmin
        .from("inventory_batch_items")
        .update({ assigned_inventory_cost_usd })
        .eq("id", itemId)
    )
  );

  return NextResponse.json({ items: updates });
}
