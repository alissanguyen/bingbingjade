import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// GET: all products with their product_costs (if any)
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const missingOnly = searchParams.get("missing") === "1";

  // Only include products that appear in at least one order recorded in orders-admin
  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("product_id")
    .not("product_id", "is", null);

  const orderedProductIds = [...new Set((orderItems ?? []).map((i) => i.product_id as string))];

  if (orderedProductIds.length === 0) {
    const { data: vendors } = await supabaseAdmin
      .from("acct_vendors")
      .select("id, vendor_code, vendor_display_name")
      .order("vendor_code");
    return NextResponse.json({ products: [], vendors: vendors ?? [] });
  }

  // Fetch only products that have been ordered
  const { data: products, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, name, category, status, imported_price_vnd")
    .in("id", orderedProductIds)
    .order("created_at", { ascending: false });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Fetch all product_costs
  const { data: costs } = await supabaseAdmin
    .from("product_costs")
    .select(`
      id, product_id, vendor_id, purchase_price_original, purchase_currency,
      exchange_rate_to_usd, purchase_price_usd, import_cost_usd,
      certification_cost_usd, inbound_shipping_cost_usd, other_cost_usd,
      label_cost_usd, total_cogs_usd, cost_last_updated_at, notes, updated_at,
      receipt_storage_path,
      acct_vendors(id, vendor_code, vendor_display_name)
    `);

  type CostRow = NonNullable<typeof costs>[number];
  const costMap = new Map<string, CostRow>();
  for (const c of costs ?? []) {
    costMap.set(c.product_id as string, c);
  }

  const rows = (products ?? [])
    .map((p) => ({
      product_id:         p.id,
      product_name:       p.name,
      category:           p.category,
      status:             p.status,
      imported_price_vnd: p.imported_price_vnd,
      cost:               costMap.get(p.id as string) ?? null,
      has_cost:           costMap.has(p.id as string),
    }))
    .filter((r) => !missingOnly || !r.has_cost);

  // Fetch all vendors for the selector
  const { data: vendors } = await supabaseAdmin
    .from("acct_vendors")
    .select("id, vendor_code, vendor_display_name")
    .order("vendor_code");

  return NextResponse.json({ products: rows, vendors: vendors ?? [] });
}

// POST: create or upsert product_cost for a product
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    product_id, vendor_id, purchase_price_original, purchase_currency,
    exchange_rate_to_usd, purchase_price_usd, import_cost_usd,
    certification_cost_usd, inbound_shipping_cost_usd, other_cost_usd, label_cost_usd, notes,
  } = body as {
    product_id: string;
    vendor_id?: string | null;
    purchase_price_original?: number;
    purchase_currency?: string;
    exchange_rate_to_usd?: number;
    purchase_price_usd: number;
    import_cost_usd?: number;
    certification_cost_usd?: number;
    inbound_shipping_cost_usd?: number;
    other_cost_usd?: number;
    label_cost_usd?: number;
    notes?: string;
  };

  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const now = new Date().toISOString();
  const purchaseUsd   = purchase_price_usd ?? 0;
  const importUsd     = import_cost_usd ?? 0;
  const certUsd       = certification_cost_usd ?? 0;
  const inboundUsd    = inbound_shipping_cost_usd ?? 0;
  const otherUsd      = other_cost_usd ?? 0;
  const computedCogs  = purchaseUsd + importUsd + certUsd + inboundUsd + otherUsd;

  const { data, error } = await supabaseAdmin
    .from("product_costs")
    .upsert({
      product_id,
      vendor_id:                vendor_id ?? null,
      purchase_price_original:  purchase_price_original ?? purchaseUsd,
      purchase_currency:        purchase_currency ?? "USD",
      exchange_rate_to_usd:     exchange_rate_to_usd ?? 1,
      purchase_price_usd:       purchaseUsd,
      import_cost_usd:          importUsd,
      certification_cost_usd:   certUsd,
      inbound_shipping_cost_usd:inboundUsd,
      other_cost_usd:           otherUsd,
      label_cost_usd:           label_cost_usd ?? 0,
      total_cogs_usd:           computedCogs,
      cost_last_updated_at:     now,
      notes:                    notes ?? null,
      updated_at:               now,
    }, { onConflict: "product_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cost: data });
}
