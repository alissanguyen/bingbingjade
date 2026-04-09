import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all non-cancelled paid orders with their line items
  // order_items.price_usd is the exact sale price per item captured at purchase time
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      amount_total,
      cogs_cents,
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

  type Entry = { revenue: number; itemRevenue: number; cogs: number; profit: number };

  const monthlyMap: Record<string, Entry> = {};
  const yearlyMap:  Record<string, Entry> = {};
  const sourceMap:  Record<string, number> = {};

  for (const o of rows) {
    const totalDollars = (o.amount_total as number) / 100;

    // Sum price_usd * quantity from order_items — the authoritative item revenue
    const items = (o.order_items ?? []) as { price_usd: number; quantity: number }[];
    const itemRevenueDollars = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);

    const cogsDollars   = ((o.cogs_cents as number | null) ?? 0) / 100;
    const profitDollars = itemRevenueDollars - cogsDollars;

    const date  = new Date(o.created_at as string);
    const year  = date.getFullYear().toString();
    const month = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, itemRevenue: 0, cogs: 0, profit: 0 };
    monthlyMap[month].revenue     += totalDollars;
    monthlyMap[month].itemRevenue += itemRevenueDollars;
    monthlyMap[month].cogs        += cogsDollars;
    monthlyMap[month].profit      += profitDollars;

    if (!yearlyMap[year]) yearlyMap[year] = { revenue: 0, itemRevenue: 0, cogs: 0, profit: 0 };
    yearlyMap[year].revenue     += totalDollars;
    yearlyMap[year].itemRevenue += itemRevenueDollars;
    yearlyMap[year].cogs        += cogsDollars;
    yearlyMap[year].profit      += profitDollars;

    const src = (o.source as string) || "unknown";
    sourceMap[src] = (sourceMap[src] ?? 0) + totalDollars;
  }

  function round2(n: number) { return Math.round(n * 100) / 100; }

  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({
      month,
      revenue:     round2(e.revenue),
      itemRevenue: round2(e.itemRevenue),
      cogs:        round2(e.cogs),
      profit:      round2(e.profit),
    }));

  const yearly = Object.entries(yearlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, e]) => ({
      year,
      revenue:     round2(e.revenue),
      itemRevenue: round2(e.itemRevenue),
      cogs:        round2(e.cogs),
      profit:      round2(e.profit),
    }));

  const bySource = Object.entries(sourceMap)
    .sort(([, a], [, b]) => b - a)
    .map(([source, revenue]) => ({ source, revenue: round2(revenue) }));

  const totals = rows.reduce(
    (acc, o) => {
      const items = (o.order_items ?? []) as { price_usd: number; quantity: number }[];
      const itemRevenueDollars = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
      const cogsDollars = ((o.cogs_cents as number | null) ?? 0) / 100;
      acc.revenue     += (o.amount_total as number) / 100;
      acc.itemRevenue += itemRevenueDollars;
      acc.cogs        += cogsDollars;
      acc.profit      += itemRevenueDollars - cogsDollars;
      return acc;
    },
    { revenue: 0, itemRevenue: 0, cogs: 0, profit: 0 }
  );

  const hasCogs = rows.some((o) => (o.cogs_cents as number | null) != null);

  return NextResponse.json({
    monthly,
    yearly,
    bySource,
    totalRevenue:     round2(totals.revenue),
    totalItemRevenue: round2(totals.itemRevenue),
    totalCogs:        round2(totals.cogs),
    totalProfit:      round2(totals.profit),
    orderCount:       rows.length,
    hasCogs,
  });
}
