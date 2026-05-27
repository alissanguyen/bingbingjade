import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      amount_total,
      inventory_expense_amount,
      inventory_expense_source,
      order_status,
      source,
      created_at,
      order_items(price_usd, quantity)
    `)
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = orders ?? [];

  function orderExpense(o: typeof rows[0]): number {
    const src = o.inventory_expense_source as string | null;
    if (src === "manual" || src === "batch_allocated") {
      return Number(o.inventory_expense_amount ?? 0);
    }
    // 'none', null (unset/uncosted) → 0
    return 0;
  }

  type Entry = { revenue: number; itemRevenue: number; inventoryExpense: number; profit: number };

  const monthlyMap: Record<string, Entry> = {};
  const yearlyMap:  Record<string, Entry> = {};
  const sourceMap:  Record<string, number> = {};
  let uncostedOrderCount = 0;

  for (const o of rows) {
    const totalDollars       = (o.amount_total as number) / 100;
    const items              = (o.order_items ?? []) as { price_usd: number; quantity: number }[];
    const itemRevenueDollars = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
    const expenseDollars     = orderExpense(o);
    const profitDollars      = itemRevenueDollars - expenseDollars;

    if ((o.inventory_expense_source as string | null) === null) uncostedOrderCount++;

    const date  = new Date(o.created_at as string);
    const year  = date.getFullYear().toString();
    const month = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, itemRevenue: 0, inventoryExpense: 0, profit: 0 };
    monthlyMap[month].revenue          += totalDollars;
    monthlyMap[month].itemRevenue      += itemRevenueDollars;
    monthlyMap[month].inventoryExpense += expenseDollars;
    monthlyMap[month].profit           += profitDollars;

    if (!yearlyMap[year]) yearlyMap[year] = { revenue: 0, itemRevenue: 0, inventoryExpense: 0, profit: 0 };
    yearlyMap[year].revenue          += totalDollars;
    yearlyMap[year].itemRevenue      += itemRevenueDollars;
    yearlyMap[year].inventoryExpense += expenseDollars;
    yearlyMap[year].profit           += profitDollars;

    const src = (o.source as string) || "unknown";
    sourceMap[src] = (sourceMap[src] ?? 0) + totalDollars;
  }

  function round2(n: number) { return Math.round(n * 100) / 100; }

  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({
      month,
      revenue:          round2(e.revenue),
      itemRevenue:      round2(e.itemRevenue),
      inventoryExpense: round2(e.inventoryExpense),
      profit:           round2(e.profit),
    }));

  const yearly = Object.entries(yearlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, e]) => ({
      year,
      revenue:          round2(e.revenue),
      itemRevenue:      round2(e.itemRevenue),
      inventoryExpense: round2(e.inventoryExpense),
      profit:           round2(e.profit),
    }));

  const bySource = Object.entries(sourceMap)
    .sort(([, a], [, b]) => b - a)
    .map(([source, revenue]) => ({ source, revenue: round2(revenue) }));

  const totals = rows.reduce(
    (acc, o) => {
      const items              = (o.order_items ?? []) as { price_usd: number; quantity: number }[];
      const itemRevenueDollars = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
      const expenseDollars     = orderExpense(o);
      acc.revenue          += (o.amount_total as number) / 100;
      acc.itemRevenue      += itemRevenueDollars;
      acc.inventoryExpense += expenseDollars;
      acc.profit           += itemRevenueDollars - expenseDollars;
      return acc;
    },
    { revenue: 0, itemRevenue: 0, inventoryExpense: 0, profit: 0 }
  );

  const hasInventoryData = rows.some((o) => (o.inventory_expense_source as string | null) !== null);

  return NextResponse.json({
    monthly,
    yearly,
    bySource,
    totalRevenue:          round2(totals.revenue),
    totalItemRevenue:      round2(totals.itemRevenue),
    totalInventoryExpense: round2(totals.inventoryExpense),
    totalProfit:           round2(totals.profit),
    orderCount:            rows.length,
    uncostedOrderCount,
    hasInventoryData,
  });
}
