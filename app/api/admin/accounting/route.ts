import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: orders, error }, { data: refundCredits }] = await Promise.all([
    supabaseAdmin
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
      .neq("status", "unpaid")
      .not("amount_total", "is", null)
      .order("created_at", { ascending: true }),
    // Store credit issued in place of a monetary refund on an already-paid
    // order — subtracted below so redeeming it later on a different order
    // doesn't double-count that revenue. See migration_124. Includes the
    // Claims workflow's reasons (lib/claims.ts issueClaimCredit always sets
    // source_order_id, with reason 'claim_resolution' or 'exchange_credit')
    // alongside the older/ad-hoc reasons issued before that workflow existed.
    supabaseAdmin
      .from("store_credits")
      .select("original_amount_cents, issued_at")
      .not("source_order_id", "is", null)
      .in("reason", ["canceled_order", "damaged_lost_package", "return", "claim_resolution", "exchange_credit"]),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = orders ?? [];

  // Bucket refund adjustments the same way orders are bucketed below, by
  // the credit's issue date.
  const monthlyAdj: Record<string, number> = {};
  const yearlyAdj:  Record<string, number> = {};
  let totalAdj = 0;
  for (const c of refundCredits ?? []) {
    const amount   = (c.original_amount_cents as number) / 100;
    const issuedAt = new Date(c.issued_at as string);
    const year     = issuedAt.getFullYear().toString();
    const month    = `${year}-${String(issuedAt.getMonth() + 1).padStart(2, "0")}`;
    monthlyAdj[month] = (monthlyAdj[month] ?? 0) + amount;
    yearlyAdj[year]   = (yearlyAdj[year] ?? 0) + amount;
    totalAdj += amount;
  }

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
      revenue:          round2(e.revenue - (monthlyAdj[month] ?? 0)),
      itemRevenue:      round2(e.itemRevenue),
      inventoryExpense: round2(e.inventoryExpense),
      profit:           round2(e.profit),
    }));

  const yearly = Object.entries(yearlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, e]) => ({
      year,
      revenue:          round2(e.revenue - (yearlyAdj[year] ?? 0)),
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
  totals.revenue -= totalAdj;

  const hasInventoryData = rows.some((o) => (o.inventory_expense_source as string | null) !== null);

  return NextResponse.json({
    monthly,
    yearly,
    revenueAdjustments: round2(totalAdj), // store credit issued as a refund on a paid order — already netted out of revenue above
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
