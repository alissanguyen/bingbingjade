import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from    = searchParams.get("from");
  const to      = searchParams.get("to");
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit   = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const offset  = (page - 1) * limit;

  let query = supabaseAdmin
    .from("orders")
    .select(`
      id, order_number, created_at, customer_name, customer_email, source,
      order_status, amount_total, discount_amount_cents, cogs_cents,
      stripe_session_id, stripe_payment_intent_id, fee_breakdown,
      order_items(id, product_id, product_name, option_label, price_usd, quantity, line_total),
      stripe_accounting_snapshots(stripe_fee_cents, stripe_net_cents, refunded_amount_cents, stripe_status),
      order_fulfillment_costs(label_cost_usd, business_shipping_insurance_cost_usd, supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd, notes)
    `, { count: "exact" })
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to + "T23:59:59Z");

  const { data: orders, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build product cost map
  const productIds = new Set<string>();
  for (const o of orders ?? []) {
    for (const item of (o.order_items ?? []) as { product_id: string | null }[]) {
      if (item.product_id) productIds.add(item.product_id);
    }
  }
  const pcMap = new Map<string, number>();
  if (productIds.size > 0) {
    const { data: pcs } = await supabaseAdmin
      .from("product_costs")
      .select("product_id, total_cogs_usd")
      .in("product_id", [...productIds]);
    for (const pc of pcs ?? []) {
      pcMap.set(pc.product_id as string, Number(pc.total_cogs_usd) || 0);
    }
  }

  // Build order_payments map for this page of orders
  const orderIds = (orders ?? []).map(o => o.id as string);
  const paymentsMap: Record<string, {
    total_paid: number;
    total_fees: number;
    total_net: number;
    providers: string[];
  }> = {};
  if (orderIds.length > 0) {
    const { data: payments } = await supabaseAdmin
      .from("order_payments")
      .select("order_id, payment_provider, amount_paid_usd, payment_fee_usd, net_received_usd, payment_status")
      .in("order_id", orderIds)
      .in("payment_status", ["paid", "partially_refunded"]);

    for (const p of payments ?? []) {
      const oid = p.order_id as string;
      if (!paymentsMap[oid]) paymentsMap[oid] = { total_paid: 0, total_fees: 0, total_net: 0, providers: [] };
      paymentsMap[oid].total_paid += Number(p.amount_paid_usd);
      paymentsMap[oid].total_fees += Number(p.payment_fee_usd);
      paymentsMap[oid].total_net  += Number(p.net_received_usd);
      const prov = p.payment_provider as string;
      if (!paymentsMap[oid].providers.includes(prov)) paymentsMap[oid].providers.push(prov);
    }
  }

  const rows = (orders ?? []).map((o) => {
    const fees      = (o.fee_breakdown ?? {}) as Record<string, number>;
    const shipping  = fees.shipping  ?? 0;
    const insurance = fees.insurance ?? 0;
    const tax       = fees.tax       ?? 0;
    const feeDiscount = fees.discount ?? 0;

    const totalDollars = (o.amount_total as number) / 100;
    const items = (o.order_items ?? []) as {
      id: string; product_id: string | null; product_name: string;
      option_label: string | null; price_usd: number; quantity: number; line_total: number | null;
    }[];

    const listedSubtotal = items.reduce(
      (s, i) => s + (i.line_total != null ? Number(i.line_total) : (i.price_usd ?? 0) * (i.quantity ?? 1)), 0
    );
    const discountApplied = (o.discount_amount_cents as number | null)
      ? (o.discount_amount_cents as number) / 100
      : feeDiscount;
    const actualItemRevenue = totalDollars - shipping - insurance - tax;

    // COGS
    let totalCogs = 0;
    let missingCogs = false;
    if ((o.cogs_cents as number | null) != null) {
      totalCogs = (o.cogs_cents as number) / 100;
    } else {
      for (const item of items) {
        const costPerUnit = item.product_id ? (pcMap.get(item.product_id) ?? null) : null;
        if (costPerUnit != null) totalCogs += costPerUnit * (item.quantity ?? 1);
        else missingCogs = true;
      }
    }

    // Stripe snapshot (kept for raw receipt data, used as fee fallback)
    const snaps = (o.stripe_accounting_snapshots ?? []) as {
      stripe_fee_cents: number | null; stripe_net_cents: number | null;
      refunded_amount_cents: number | null; stripe_status: string | null;
    }[];
    const snap = snaps[0] ?? null;
    const stripeFeeFallback = snap?.stripe_fee_cents != null ? snap.stripe_fee_cents / 100 : null;
    const stripeNet = snap?.stripe_net_cents != null ? snap.stripe_net_cents / 100 : null;
    const refunded  = snap?.refunded_amount_cents ? snap.refunded_amount_cents / 100 : 0;

    // Payment ledger (universal: Stripe + manual)
    const pm = paymentsMap[o.id as string] ?? null;
    const totalPaid     = pm ? r2(pm.total_paid) : null;   // null = no payments recorded yet
    const paymentFee    = pm ? r2(pm.total_fees) : (stripeFeeFallback != null ? r2(stripeFeeFallback) : null);
    const netReceived   = pm ? r2(pm.total_net) : stripeNet;
    const providers     = pm?.providers ?? (snap ? ["stripe"] : []);
    const amountDue     = totalPaid != null ? r2(totalDollars - totalPaid) : null;

    // Reconciliation status
    let reconcileStatus = "no_payments";
    if (totalPaid != null) {
      if (totalPaid >= totalDollars - 0.01) reconcileStatus = "paid";
      else if (totalPaid > 0) reconcileStatus = "partial";
      else reconcileStatus = "unpaid";
    }

    // Fulfillment
    const fc = ((o.order_fulfillment_costs ?? []) as {
      label_cost_usd: number; business_shipping_insurance_cost_usd: number;
      supplies_cost_usd: number; dropoff_transport_cost_usd: number;
      other_fulfillment_cost_usd: number; notes: string | null;
    }[])[0] ?? null;
    const labelCost    = fc?.label_cost_usd                       ?? 0;
    const insuranceCost= fc?.business_shipping_insurance_cost_usd ?? 0;
    const suppliesCost = fc?.supplies_cost_usd                    ?? 20;
    const dropoffCost  = fc?.dropoff_transport_cost_usd           ?? 0;
    const otherFCost   = fc?.other_fulfillment_cost_usd           ?? 0;
    const totalFulfillment = labelCost + insuranceCost + suppliesCost + dropoffCost + otherFCost;

    const effectiveFee = paymentFee ?? 0;
    const estimatedProfit = missingCogs && totalCogs === 0
      ? null
      : r2(
          (actualItemRevenue + shipping + insurance)
          - tax
          - effectiveFee
          - totalCogs
          - totalFulfillment
        );

    return {
      id:                   o.id,
      order_number:         o.order_number,
      created_at:           o.created_at,
      customer_name:        o.customer_name,
      customer_email:       o.customer_email,
      source:               o.source,
      order_status:         o.order_status,
      stripe_session_id:    o.stripe_session_id,
      stripe_pi_id:         o.stripe_payment_intent_id,
      // Revenue breakdown
      amount_total:         r2(totalDollars),
      listed_subtotal:      r2(listedSubtotal),
      discount_applied:     r2(discountApplied),
      actual_item_revenue:  r2(actualItemRevenue),
      shipping_charged:     r2(shipping),
      insurance_charged:    r2(insurance),
      sales_tax:            r2(tax),
      // Payment ledger
      total_paid:           totalPaid,
      payment_fee:          paymentFee,
      net_received:         netReceived,
      amount_due:           amountDue,
      reconcile_status:     reconcileStatus,
      payment_providers:    providers,
      // Stripe raw (kept for backward compat)
      stripe_fee:           stripeFeeFallback != null ? r2(stripeFeeFallback) : null,
      stripe_net:           stripeNet != null ? r2(stripeNet) : null,
      refunded:             r2(refunded),
      stripe_status:        snap?.stripe_status ?? null,
      has_stripe_data:      snap != null,
      // Costs
      total_cogs:           r2(totalCogs),
      missing_cogs:         missingCogs,
      label_cost:           r2(labelCost),
      insurance_cost:       r2(insuranceCost),
      supplies_cost:        r2(suppliesCost),
      dropoff_cost:         r2(dropoffCost),
      other_fulfillment:    r2(otherFCost),
      total_fulfillment:    r2(totalFulfillment),
      // Profit
      estimated_profit:     estimatedProfit,
      // Items
      items: items.map((i) => ({
        id:          i.id,
        product_id:  i.product_id,
        name:        i.product_name,
        option:      i.option_label,
        price:       i.price_usd,
        qty:         i.quantity,
        line_total:  i.line_total ?? r2((i.price_usd ?? 0) * (i.quantity ?? 1)),
        has_cogs:    i.product_id ? pcMap.has(i.product_id) : false,
        cogs_per_unit: i.product_id ? (pcMap.get(i.product_id) ?? null) : null,
      })),
    };
  });

  return NextResponse.json({ orders: rows, total: count ?? 0, page, limit });
}
