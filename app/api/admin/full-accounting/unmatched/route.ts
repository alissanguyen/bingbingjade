import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/full-accounting/unmatched
// Returns 4 reconciliation issue categories (capped at 50 per category):
//   1. stripe_unmatched    - Stripe payments in order_payments with no order_id
//   2. manual_unlinked     - Non-Stripe payments with no order_id
//   3. unbalanced_orders   - Orders where total paid ≠ order total (within recent 12 months)
//   4. missing_cogs        - Non-cancelled orders with no product_costs entry
//   5. missing_fulfillment - Non-cancelled orders with no fulfillment cost entry
export async function GET() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1 & 2: Payments without an order link ─────────────────────────────────
  const { data: unlinkedPayments } = await supabaseAdmin
    .from("order_payments")
    .select("id, bbj_order_code, payment_provider, payment_type, amount_paid_usd, payment_date, payment_status, notes")
    .is("order_id", null)
    .order("payment_date", { ascending: false })
    .limit(50);

  const stripe_unmatched = (unlinkedPayments ?? []).filter(p => p.payment_provider === "stripe");
  const manual_unlinked  = (unlinkedPayments ?? []).filter(p => p.payment_provider !== "stripe");

  // ── 3: Unbalanced orders — total paid ≠ order total ───────────────────────
  // Scope to last 12 months to keep the query manageable
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoff = twelveMonthsAgo.toISOString();

  const { data: recentOrders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, amount_total, order_status, created_at")
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  const recentOrderIds = (recentOrders ?? []).map(o => o.id);

  let paymentsByOrder: Record<string, number> = {};
  if (recentOrderIds.length > 0) {
    const { data: payments } = await supabaseAdmin
      .from("order_payments")
      .select("order_id, amount_paid_usd, payment_status")
      .in("order_id", recentOrderIds)
      .in("payment_status", ["paid", "partially_refunded"]);

    for (const p of payments ?? []) {
      paymentsByOrder[p.order_id] = (paymentsByOrder[p.order_id] ?? 0) + Number(p.amount_paid_usd);
    }
  }

  const unbalanced_orders = (recentOrders ?? [])
    .map(o => {
      const totalPaid = paymentsByOrder[o.id] ?? 0;
      const orderTotal = (o.amount_total as number) / 100;
      const diff = Math.round((orderTotal - totalPaid) * 100) / 100;
      return { ...o, amount_total_usd: orderTotal, total_paid: Math.round(totalPaid * 100) / 100, amount_due: diff };
    })
    .filter(o => Math.abs(o.amount_due) > 0.01)
    .slice(0, 50);

  // ── 4: Missing COGS ────────────────────────────────────────────────────────
  // Orders where none of the order_items has a product_costs row
  const { data: ordersForCogs } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, created_at, order_status, order_items(product_id)")
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const allProductIds = new Set<string>();
  for (const o of ordersForCogs ?? []) {
    for (const item of (o.order_items as { product_id: string | null }[]) ?? []) {
      if (item.product_id) allProductIds.add(item.product_id);
    }
  }

  let costsSet = new Set<string>();
  if (allProductIds.size > 0) {
    const { data: costs } = await supabaseAdmin
      .from("product_costs")
      .select("product_id")
      .in("product_id", [...allProductIds]);
    costsSet = new Set((costs ?? []).map(c => c.product_id as string));
  }

  const missing_cogs = (ordersForCogs ?? [])
    .filter(o => {
      const items = (o.order_items as { product_id: string | null }[]) ?? [];
      return items.some(i => i.product_id && !costsSet.has(i.product_id));
    })
    .slice(0, 50)
    .map(o => ({
      id:            o.id,
      order_number:  o.order_number,
      customer_name: o.customer_name,
      created_at:    o.created_at,
      order_status:  o.order_status,
    }));

  // ── 5: Missing fulfillment costs ───────────────────────────────────────────
  const { data: ordersWithFulfillment } = await supabaseAdmin
    .from("order_fulfillment_costs")
    .select("order_id");
  const fulfilledOrderIds = new Set((ordersWithFulfillment ?? []).map(r => r.order_id));

  const missing_fulfillment = (recentOrders ?? [])
    .filter(o => !fulfilledOrderIds.has(o.id))
    .slice(0, 50)
    .map(o => ({
      id:              o.id,
      order_number:    o.order_number,
      customer_name:   o.customer_name,
      amount_total_usd: (o.amount_total as number) / 100,
      created_at:      o.created_at,
    }));

  return NextResponse.json({
    stripe_unmatched,
    manual_unlinked,
    unbalanced_orders,
    missing_cogs,
    missing_fulfillment,
    counts: {
      stripe_unmatched:    stripe_unmatched.length,
      manual_unlinked:     manual_unlinked.length,
      unbalanced_orders:   unbalanced_orders.length,
      missing_cogs:        missing_cogs.length,
      missing_fulfillment: missing_fulfillment.length,
      total: stripe_unmatched.length + manual_unlinked.length + unbalanced_orders.length + missing_cogs.length + missing_fulfillment.length,
    },
  });
}
