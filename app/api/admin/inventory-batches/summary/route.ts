/**
 * GET /api/admin/inventory-batches/summary?period=all|1m|3m|6m|1y
 *
 * Returns aggregated stats across all batches in the requested period.
 * Period is based on batch purchase_date, falling back to created_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const period = req.nextUrl.searchParams.get("period") ?? "all";

  let cutoff: Date | null = null;
  if (period !== "all") {
    cutoff = new Date();
    if (period === "1m") cutoff.setMonth(cutoff.getMonth() - 1);
    if (period === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
    if (period === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    if (period === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  }

  const { data: allBatches } = await supabaseAdmin
    .from("inventory_batches")
    .select("id, total_batch_cost_usd, item_count, purchase_date, created_at");

  const batches = (allBatches ?? []).filter((b) => {
    if (!cutoff) return true;
    const dateStr = b.purchase_date ?? b.created_at;
    return dateStr ? new Date(dateStr) >= cutoff : false;
  });

  const totalSpent = batches.reduce((s, b) => s + Number(b.total_batch_cost_usd ?? 0), 0);
  const productCount = batches.reduce((s, b) => s + (Number(b.item_count) || 0), 0);
  const batchIds = batches.map((b) => b.id);

  if (batchIds.length === 0) {
    return NextResponse.json({ total_spent: 0, product_count: 0, sold_count: 0, revenue: 0, net_profit: 0 });
  }

  const { data: batchItems } = await supabaseAdmin
    .from("inventory_batch_items")
    .select("product_id, item_expense_usd")
    .in("batch_id", batchIds);
  const linkedProductIds = [
    ...new Set((batchItems ?? []).map((i) => i.product_id).filter((id): id is string => !!id)),
  ];

  if (linkedProductIds.length === 0) {
    return NextResponse.json({ total_spent: totalSpent, product_count: productCount, sold_count: 0, revenue: 0, net_profit: -totalSpent });
  }

  const { data: productData } = await supabaseAdmin
    .from("products")
    .select("id, status")
    .in("id", linkedProductIds);

  const soldProductIds = new Set(
    (productData ?? []).filter((p) => p.status === "sold").map((p) => p.id)
  );
  const soldCount = soldProductIds.size;

  const soldItemExpenses = (batchItems ?? [])
    .filter((i) => i.product_id && soldProductIds.has(i.product_id))
    .reduce((s, i) => s + Number(i.item_expense_usd ?? 0), 0);

  let revenue = 0;
  if (soldProductIds.size > 0) {
    const { data: orderItems } = await supabaseAdmin
      .from("order_items")
      .select("product_id, price_usd, quantity, order_id")
      .in("product_id", [...soldProductIds]);

    const orderIds = [...new Set((orderItems ?? []).map((i) => i.order_id).filter(Boolean))];
    if (orderIds.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id")
        .in("id", orderIds)
        .neq("order_status", "order_cancelled");

      const validOrderIds = new Set((orders ?? []).map((o) => o.id));
      revenue = (orderItems ?? [])
        .filter((i) => i.order_id && validOrderIds.has(i.order_id))
        .reduce((sum, i) => sum + Number(i.price_usd ?? 0) * Number(i.quantity ?? 1), 0);
    }
  }

  const netProfit = revenue - totalSpent - soldItemExpenses;

  return NextResponse.json({ total_spent: totalSpent, product_count: productCount, sold_count: soldCount, revenue, net_profit: netProfit });
}
