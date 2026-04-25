import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// GET: all orders with their fulfillment costs (or defaults if not set)
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from  = searchParams.get("from");
  const to    = searchParams.get("to");
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  let query = supabaseAdmin
    .from("orders")
    .select(`
      id, order_number, created_at, customer_name, order_status, amount_total,
      order_fulfillment_costs(id, label_cost_usd, business_shipping_insurance_cost_usd, supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd, notes)
    `, { count: "exact" })
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to + "T23:59:59Z");

  const { data: orders, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (orders ?? []).map((o) => {
    const fc = ((o.order_fulfillment_costs ?? []) as Record<string, unknown>[])[0] ?? null;
    return {
      order_id:          o.id,
      order_number:      o.order_number,
      created_at:        o.created_at,
      customer_name:     o.customer_name,
      order_status:      o.order_status,
      amount_total:      (o.amount_total as number) / 100,
      fulfillment_cost_id: fc?.id ?? null,
      label_cost:        Number(fc?.label_cost_usd ?? 0),
      insurance_cost:    Number(fc?.business_shipping_insurance_cost_usd ?? 0),
      supplies_cost:     Number(fc?.supplies_cost_usd ?? 20),
      dropoff_cost:      Number(fc?.dropoff_transport_cost_usd ?? 0),
      other_cost:        Number(fc?.other_fulfillment_cost_usd ?? 0),
      notes:             (fc?.notes as string) ?? null,
      has_entry:         fc != null,
    };
  });

  return NextResponse.json({ rows, total: count ?? 0, page, limit });
}

// POST: upsert fulfillment costs for an order
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    order_id, label_cost_usd, business_shipping_insurance_cost_usd,
    supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd, notes,
  } = body as {
    order_id: string;
    label_cost_usd?: number;
    business_shipping_insurance_cost_usd?: number;
    supplies_cost_usd?: number;
    dropoff_transport_cost_usd?: number;
    other_fulfillment_cost_usd?: number;
    notes?: string;
  };

  if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("order_fulfillment_costs")
    .upsert({
      order_id,
      label_cost_usd:                       label_cost_usd ?? 0,
      business_shipping_insurance_cost_usd: business_shipping_insurance_cost_usd ?? 0,
      supplies_cost_usd:                    supplies_cost_usd ?? 20,
      dropoff_transport_cost_usd:           dropoff_transport_cost_usd ?? 0,
      other_fulfillment_cost_usd:           other_fulfillment_cost_usd ?? 0,
      notes:                                notes ?? null,
      updated_at:                           now,
    }, { onConflict: "order_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fulfillment_cost: data });
}
