import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const category = searchParams.get("category");

  let query = supabaseAdmin
    .from("business_expenses")
    .select("vendor, payment_method, amount_usd, business_use_percent, category");

  if (from)     query = query.gte("expense_date", from);
  if (to)       query = query.lte("expense_date", to);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Bucket = { total: number; deductible: number; count: number };
  const vendorMap  = new Map<string, Bucket>();
  const methodMap  = new Map<string, Bucket>();
  const categoryMap = new Map<string, Bucket>();

  for (const e of data ?? []) {
    const amount     = Number(e.amount_usd);
    const deductible = amount * (Number(e.business_use_percent) / 100);

    const vendor = e.vendor?.trim()           || "(none)";
    const method = e.payment_method?.trim()   || "(none)";
    const cat    = e.category?.trim()         || "(none)";

    for (const [map, key] of [[vendorMap, vendor], [methodMap, method], [categoryMap, cat]] as [Map<string, Bucket>, string][]) {
      const b = map.get(key) ?? { total: 0, deductible: 0, count: 0 };
      b.total      += amount;
      b.deductible += deductible;
      b.count++;
      map.set(key, b);
    }
  }

  const sort = (map: Map<string, Bucket>) =>
    [...map.entries()].map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total);

  return NextResponse.json({
    byVendor:   sort(vendorMap),
    byMethod:   sort(methodMap),
    byCategory: sort(categoryMap),
  });
}
