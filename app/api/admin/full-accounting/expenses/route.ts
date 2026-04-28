import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const category = searchParams.get("category");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit    = Math.min(200, parseInt(searchParams.get("limit") ?? "100"));

  let query = supabaseAdmin
    .from("business_expenses")
    .select("*", { count: "exact" })
    .order("expense_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (from)     query = query.gte("expense_date", from);
  if (to)       query = query.lte("expense_date", to);
  if (category) query = query.eq("category", category);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shipping delta: total shipping expenses vs shipping collected from customers
  let shippingExpQuery = supabaseAdmin
    .from("business_expenses")
    .select("amount_usd")
    .eq("category", "shipping");
  if (from) shippingExpQuery = shippingExpQuery.gte("expense_date", from);
  if (to)   shippingExpQuery = shippingExpQuery.lte("expense_date", to);
  const { data: shippingExpRows } = await shippingExpQuery;
  const shippingExpenses = (shippingExpRows ?? []).reduce((s, r) => s + Number(r.amount_usd), 0);

  let shippingRevQuery = supabaseAdmin
    .from("stripe_accounting_snapshots")
    .select("amount_shipping_cents");
  if (from) shippingRevQuery = shippingRevQuery.gte("stripe_created_at", from);
  if (to)   shippingRevQuery = shippingRevQuery.lte("stripe_created_at", to + "T23:59:59Z");
  const { data: shippingRevRows } = await shippingRevQuery;
  const shippingRevenue = (shippingRevRows ?? []).reduce((s, r) => s + Number(r.amount_shipping_cents ?? 0), 0) / 100;

  return NextResponse.json({ expenses: data ?? [], total: count ?? 0, page, limit, shippingExpenses, shippingRevenue });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    expense_date, vendor, category, amount_usd, payment_method,
    receipt_url, business_use_percent, notes,
  } = body as {
    expense_date: string;
    vendor?: string;
    category: string;
    amount_usd: number;
    payment_method?: string;
    receipt_url?: string;
    business_use_percent?: number;
    notes?: string;
  };

  if (!expense_date || !category || !amount_usd) {
    return NextResponse.json({ error: "expense_date, category, and amount_usd are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("business_expenses")
    .insert({
      expense_date,
      vendor:               vendor?.trim() || null,
      category,
      amount_usd,
      payment_method:       payment_method?.trim() || null,
      receipt_url:          receipt_url?.trim() || null,
      business_use_percent: business_use_percent ?? 100,
      notes:                notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
