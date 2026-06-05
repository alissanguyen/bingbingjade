import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function r2(n: number) { return Math.round(n * 100) / 100; }

function getQuarter(dateStr: string): 1 | 2 | 3 | 4 {
  const m = new Date(dateStr).getMonth() + 1; // 1–12
  return m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to   = searchParams.get("to");   // YYYY-MM-DD
  const year = searchParams.get("year"); // when set → also return quarterly[]

  // ── 1. Parallel fetches ────────────────────────────────────────────────────
  let ordersQuery = supabaseAdmin
    .from("orders")
    .select(`
      id, amount_total, discount_amount_cents, source, created_at,
      inventory_expense_amount, inventory_expense_source,
      stripe_session_id,
      fee_breakdown,
      order_items(price_usd, quantity, product_id),
      order_fulfillment_costs(label_cost_usd, business_shipping_insurance_cost_usd, supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd)
    `)
    .neq("order_status", "order_cancelled")
    .not("amount_total", "is", null);

  if (from) ordersQuery = ordersQuery.gte("created_at", from);
  if (to)   ordersQuery = ordersQuery.lte("created_at", to + "T23:59:59Z");

  let pmDateQuery = supabaseAdmin
    .from("order_payments")
    .select("order_id, amount_paid_usd, payment_fee_usd, net_received_usd, payment_date, payment_status")
    .in("payment_status", ["paid", "partially_refunded"]);
  if (from) pmDateQuery = pmDateQuery.gte("payment_date", from);
  if (to)   pmDateQuery = pmDateQuery.lte("payment_date", to + "T23:59:59Z");

  let expQuery = supabaseAdmin
    .from("business_expenses")
    .select("amount_usd, deductible_amount_usd, category, expense_date");
  if (from) expQuery = expQuery.gte("expense_date", from.slice(0, 7) + "-01");
  if (to)   expQuery = expQuery.lte("expense_date", to);

  const [
    { data: orders, error: ordErr },
    { data: pmDate },
    { data: expenses },
    { data: settingsRow },
  ] = await Promise.all([
    ordersQuery,
    pmDateQuery,
    expQuery,
    supabaseAdmin.from("accounting_settings").select("default_supplies_cost_per_order").limit(1).maybeSingle(),
  ]);

  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  const defaultSuppliesPerOrder = Number(settingsRow?.default_supplies_cost_per_order ?? 20);

  // ── 1b. Secondary fetch — Stripe snapshots for tax/shipping fallback ────────
  const stripeSessionIds = (orders ?? [])
    .map((o) => o.stripe_session_id as string | null)
    .filter(Boolean) as string[];

  const { data: snapshots } = stripeSessionIds.length > 0
    ? await supabaseAdmin
        .from("stripe_accounting_snapshots")
        .select("stripe_session_id, amount_tax_cents, amount_shipping_cents")
        .in("stripe_session_id", stripeSessionIds)
    : { data: [] as { stripe_session_id: string | null; amount_tax_cents: number | null; amount_shipping_cents: number | null }[] };

  // Stripe snapshot map: session_id → { tax, shipping }
  const snapshotMap = new Map<string, { tax: number; shipping: number }>();
  for (const s of snapshots ?? []) {
    if (s.stripe_session_id) {
      snapshotMap.set(s.stripe_session_id as string, {
        tax:      ((s.amount_tax_cents      as number | null) ?? 0) / 100,
        shipping: ((s.amount_shipping_cents as number | null) ?? 0) / 100,
      });
    }
  }

  // ── 2. Payments by order_id (reconciliation status per order) ─────────────
  const orderIds = (orders ?? []).map((o) => o.id as string);
  const orderPaidMap: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: allPm } = await supabaseAdmin
      .from("order_payments")
      .select("order_id, amount_paid_usd, payment_status")
      .in("order_id", orderIds)
      .in("payment_status", ["paid", "partially_refunded"]);
    for (const p of allPm ?? []) {
      orderPaidMap[p.order_id as string] = (orderPaidMap[p.order_id as string] ?? 0) + Number(p.amount_paid_usd);
    }
  }

  // ── 3. Aggregate revenue + costs (order basis) ─────────────────────────────
  let grossSales               = 0;
  let discountTotal            = 0;
  let taxCollected             = 0;
  let txFeeTotal               = 0; // "Transaction Fee" line item charged to customer
  let cogsTotal                = 0;
  let fulfillmentCostTotal     = 0;  // includes per-order supplies estimate (for display)
  let fulfillmentCostExSupplies = 0; // label + insurance + dropoff + other only
  let estimatedSuppliesCostTotal = 0; // sum of per-order supplies estimates
  let shippingRevenue          = 0;
  let insuranceRevenue         = 0;

  const monthlyMap: Record<string, {
    revenue: number; discount: number; tax: number; cashReceived: number;
    paymentFee: number; cogs: number; fulfillment: number;
    suppliesEstimate: number; profit: number; taxReadyProfit: number;
  }> = {};

  // Quarter accumulators (revenue/costs by order date)
  const qRev: Record<number, {
    revenue: number; discount: number; tax: number; cogs: number;
    fulfillment: number; suppliesEstimate: number;
  }> = {
    1: { revenue: 0, discount: 0, tax: 0, cogs: 0, fulfillment: 0, suppliesEstimate: 0 },
    2: { revenue: 0, discount: 0, tax: 0, cogs: 0, fulfillment: 0, suppliesEstimate: 0 },
    3: { revenue: 0, discount: 0, tax: 0, cogs: 0, fulfillment: 0, suppliesEstimate: 0 },
    4: { revenue: 0, discount: 0, tax: 0, cogs: 0, fulfillment: 0, suppliesEstimate: 0 },
  };

  for (const o of orders ?? []) {
    const fees      = (o.fee_breakdown ?? {}) as Record<string, number>;
    const sessionId = o.stripe_session_id as string | null;
    const snap      = sessionId ? (snapshotMap.get(sessionId) ?? null) : null;

    // Tax: prefer fee_breakdown.tax, fall back to Stripe snapshot (covers pre-fix orders)
    const tax       = (fees.tax ?? 0) > 0 ? (fees.tax ?? 0) : (snap?.tax ?? 0);
    // Shipping/insurance: prefer fee_breakdown, fall back to Stripe snapshot shipping total
    const shipping  = (fees.shipping  ?? 0) > 0 ? (fees.shipping  ?? 0) : (snap?.shipping ?? 0);
    const insurance = fees.insurance ?? 0;
    // Transaction fee charged to customer (stored as 'paypal' key for legacy reasons)
    const txFee     = fees.paypal ?? 0;
    const discount  = fees.discount  ?? (o.discount_amount_cents ?? 0) / 100;
    const total     = (o.amount_total as number) / 100;

    const expSrc = o.inventory_expense_source as string | null;
    const cogs = (expSrc === "manual" || expSrc === "batch_allocated")
      ? Number(o.inventory_expense_amount ?? 0)
      : 0;

    const fc = ((o.order_fulfillment_costs ?? []) as {
      label_cost_usd: number; business_shipping_insurance_cost_usd: number;
      supplies_cost_usd: number; dropoff_transport_cost_usd: number; other_fulfillment_cost_usd: number;
    }[])[0] ?? null;

    // Split supplies from the rest of fulfillment
    const suppliesEstimate = fc != null ? Number(fc.supplies_cost_usd) : defaultSuppliesPerOrder;
    const fulfillmentEx = fc
      ? fc.label_cost_usd + fc.business_shipping_insurance_cost_usd +
        fc.dropoff_transport_cost_usd + fc.other_fulfillment_cost_usd
      : 0;
    const fulfillment = fulfillmentEx + suppliesEstimate;

    grossSales               += total;
    discountTotal            += discount;
    taxCollected             += tax;
    txFeeTotal               += txFee;
    cogsTotal                += cogs;
    fulfillmentCostTotal     += fulfillment;
    fulfillmentCostExSupplies += fulfillmentEx;
    estimatedSuppliesCostTotal += suppliesEstimate;
    shippingRevenue          += shipping;
    insuranceRevenue         += insurance;

    const month = (o.created_at as string).slice(0, 7);
    if (!monthlyMap[month]) {
      monthlyMap[month] = {
        revenue: 0, discount: 0, tax: 0, cashReceived: 0, paymentFee: 0,
        cogs: 0, fulfillment: 0, suppliesEstimate: 0, profit: 0, taxReadyProfit: 0,
      };
    }
    monthlyMap[month].revenue         += total;
    monthlyMap[month].discount        += discount;
    monthlyMap[month].tax             += tax;
    monthlyMap[month].cogs            += cogs;
    monthlyMap[month].fulfillment     += fulfillment;
    monthlyMap[month].suppliesEstimate += suppliesEstimate;

    if (year) {
      const q = getQuarter(o.created_at as string);
      qRev[q].revenue          += total;
      qRev[q].discount         += discount;
      qRev[q].tax              += tax;
      qRev[q].cogs             += cogs;
      qRev[q].fulfillment      += fulfillment;
      qRev[q].suppliesEstimate += suppliesEstimate;
    }
  }

  // ── 4. Aggregate cash (payment basis) ─────────────────────────────────────
  let cashReceived    = 0;
  let paymentFeeTotal = 0;
  let netCashReceived = 0;

  const qCash: Record<number, { received: number; fees: number; net: number }> = {
    1: { received: 0, fees: 0, net: 0 },
    2: { received: 0, fees: 0, net: 0 },
    3: { received: 0, fees: 0, net: 0 },
    4: { received: 0, fees: 0, net: 0 },
  };
  const monthCashMap: Record<string, { received: number; fees: number; net: number }> = {};

  for (const p of pmDate ?? []) {
    const amt = Number(p.amount_paid_usd);
    const fee = Number(p.payment_fee_usd);
    const net = Number(p.net_received_usd);
    cashReceived    += amt;
    paymentFeeTotal += fee;
    netCashReceived += net;

    const month = (p.payment_date as string).slice(0, 7);
    if (!monthCashMap[month]) monthCashMap[month] = { received: 0, fees: 0, net: 0 };
    monthCashMap[month].received += amt;
    monthCashMap[month].fees     += fee;
    monthCashMap[month].net      += net;

    if (year) {
      const q = getQuarter(p.payment_date as string);
      qCash[q].received += amt;
      qCash[q].fees     += fee;
      qCash[q].net      += net;
    }
  }

  // ── 5. Aggregate expenses — separate supplies from other categories ─────────
  // expenseTotal uses deductible_amount_usd for tax purposes
  let expenseTotal               = 0;
  let actualSuppliesSpend        = 0; // raw amount_usd for reconciliation display
  let actualSuppliesSpendDeduct  = 0; // deductible amount for P&L
  const expenseByCategory: Record<string, number> = {};
  const qExpenses:       Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const qSuppliesActual: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  // Month maps for supplies actual
  const monthSuppliesActual: Record<string, number> = {};

  for (const e of expenses ?? []) {
    const cat    = e.category as string;
    const raw    = Number(e.amount_usd);
    const deduct = Number(e.deductible_amount_usd ?? e.amount_usd);

    expenseTotal += deduct;
    expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + raw;

    if (cat === "supplies" || cat === "shipping") {
      actualSuppliesSpend       += raw;
      actualSuppliesSpendDeduct += deduct;

      const edMonth = (e.expense_date as string).slice(0, 7);
      monthSuppliesActual[edMonth] = (monthSuppliesActual[edMonth] ?? 0) + raw;
    }

    if (year) {
      const q = getQuarter(e.expense_date as string);
      qExpenses[q] += deduct;
      if (cat === "supplies" || cat === "shipping") qSuppliesActual[q] += deduct;
    }
  }

  // ── 6. Order reconciliation counts ────────────────────────────────────────
  let unpaidCount = 0, partialCount = 0, paidCount = 0;
  for (const o of orders ?? []) {
    const totalPaid  = orderPaidMap[o.id as string] ?? 0;
    const orderTotal = (o.amount_total as number) / 100;
    if (totalPaid === 0)                    unpaidCount++;
    else if (totalPaid < orderTotal - 0.01) partialCount++;
    else                                    paidCount++;
  }

  // ── 7. Profit calculations ─────────────────────────────────────────────────
  //
  // Transaction fees (txFeeTotal) are collected from customers and included in
  // gross revenue / net cash, but immediately paid out to payment processors.
  // They must be deducted from profit to avoid overstating earnings.
  // (Stripe processing fees are already removed via netCashReceived; txFee covers
  //  PayPal surcharges and any excess collected beyond actual processor cost.)
  //
  // Option B (tax-ready): use actual supplies from business_expenses.
  //   taxReadyProfit = net - tax - txFees - COGS - fulfillmentExSupplies - allExpenses
  //
  // Estimated (operational): use per-order supply estimates, exclude actual supplies expense.
  //   estimatedNetProfit = net - tax - txFees - COGS - fulfillmentTotal - (allExpenses - actualSuppliesDeduct)
  //
  const nonSuppliesExpenseTotal = expenseTotal - actualSuppliesSpendDeduct;
  const taxReadyProfit    = r2(netCashReceived - taxCollected - txFeeTotal - cogsTotal - fulfillmentCostExSupplies - expenseTotal);
  const estimatedNetProfit = r2(netCashReceived - taxCollected - txFeeTotal - cogsTotal - fulfillmentCostTotal - nonSuppliesExpenseTotal);

  // Supplies reconciliation
  const orderCount         = (orders ?? []).length;
  const suppliesDelta      = r2(actualSuppliesSpend - estimatedSuppliesCostTotal);
  const suppliesDeltaPct   = estimatedSuppliesCostTotal > 0
    ? r2((suppliesDelta / estimatedSuppliesCostTotal) * 100)
    : null;
  const actualAvgSuppliesPerOrder = orderCount > 0 ? r2(actualSuppliesSpend / orderCount) : 0;

  // ── 8. Monthly profit blend ────────────────────────────────────────────────
  for (const month of Object.keys(monthlyMap)) {
    const cash         = monthCashMap[month] ?? { received: 0, fees: 0, net: 0 };
    const supActual    = monthSuppliesActual[month] ?? 0;
    const m            = monthlyMap[month];
    m.cashReceived     = cash.received;
    m.paymentFee       = cash.fees;
    // Estimated profit: use per-order supplies in fulfillment, exclude actual supplies from expenses
    // (We can only use expenseByCategory totals here, not a per-month expense total without another map)
    // Simplified: for monthly we subtract full fulfillment (includes supply estimate) and no separate expense deduct
    m.profit           = cash.net - m.tax - m.cogs - m.fulfillment;
    m.taxReadyProfit   = cash.net - m.tax - m.cogs - (m.fulfillment - m.suppliesEstimate) - supActual;
  }
  // Add months that only have cash (no orders)
  for (const month of Object.keys(monthCashMap)) {
    if (!monthlyMap[month]) {
      const cash = monthCashMap[month];
      monthlyMap[month] = {
        revenue: 0, discount: 0, tax: 0,
        cashReceived: cash.received, paymentFee: cash.fees,
        cogs: 0, fulfillment: 0, suppliesEstimate: 0,
        profit: cash.net, taxReadyProfit: cash.net,
      };
    }
  }

  const outstandingBalance = r2(grossSales - cashReceived);

  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      revenue:          r2(v.revenue),
      discount:         r2(v.discount),
      tax:              r2(v.tax),
      cashReceived:     r2(v.cashReceived),
      paymentFee:       r2(v.paymentFee),
      cogs:             r2(v.cogs),
      fulfillment:      r2(v.fulfillment),
      suppliesEstimate: r2(v.suppliesEstimate),
      profit:           r2(v.profit),
      taxReadyProfit:   r2(v.taxReadyProfit),
    }));

  // ── 9. Quarterly breakdown (only when year param provided) ───────────────
  const QTR_LABELS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"] as const;
  const quarterly = year
    ? ([1, 2, 3, 4] as const).map((q) => {
        const rev          = qRev[q];
        const cash         = qCash[q];
        const exp          = qExpenses[q];
        const supActual    = qSuppliesActual[q];
        const fulfillmentEx = rev.fulfillment - rev.suppliesEstimate;

        // Tax-ready (Option B): actual supplies via expenses, no per-order supply estimate in fulfillment
        const taxReadyProfit = r2(cash.net - rev.tax - rev.cogs - fulfillmentEx - exp);
        // Estimated: per-order supply estimate in fulfillment, actual supplies excluded from expenses
        const estimated_profit = r2(cash.net - rev.tax - rev.cogs - rev.fulfillment - (exp - supActual));

        return {
          quarter:                q,
          year:                   Number(year),
          label:                  `${year}-Q${q}`,
          range_label:            QTR_LABELS[q - 1],
          gross_sales:            r2(rev.revenue),
          discounts:              r2(rev.discount),
          tax_collected:          r2(rev.tax),
          cash_received:          r2(cash.received),
          payment_fees:           r2(cash.fees),
          net_cash_received:      r2(cash.net),
          cogs:                   r2(rev.cogs),
          fulfillment:            r2(rev.fulfillment),
          fulfillment_ex_supplies: r2(fulfillmentEx),
          estimated_supplies_cost: r2(rev.suppliesEstimate),
          actual_supplies_spend:  r2(supActual),
          supplies_delta:         r2(supActual - rev.suppliesEstimate),
          business_expenses:      r2(exp),
          estimated_profit,
          tax_ready_profit:       taxReadyProfit,
        };
      })
    : undefined;

  return NextResponse.json({
    // Revenue basis (from orders)
    grossSales:              r2(grossSales),
    grossRevenue:            r2(grossSales), // backward-compat alias
    discountTotal:           r2(discountTotal),
    taxCollected:            r2(taxCollected),
    // Cash basis (from order_payments)
    cashReceived:            r2(cashReceived),
    paymentFeeTotal:         r2(paymentFeeTotal),
    netCashReceived:         r2(netCashReceived),
    outstandingBalance,
    // Costs
    cogsTotal:               r2(cogsTotal),
    fulfillmentCostTotal:    r2(fulfillmentCostTotal),     // includes per-order supplies estimate
    fulfillmentCostExSupplies: r2(fulfillmentCostExSupplies), // label+insurance+dropoff+other only
    businessExpenseTotal:    r2(expenseTotal),
    shippingRevenue:         r2(shippingRevenue),
    insuranceRevenue:        r2(insuranceRevenue),
    txFeeTotal:              r2(txFeeTotal),
    // Supplies reconciliation
    defaultSuppliesPerOrder,
    estimatedSuppliesCost:   r2(estimatedSuppliesCostTotal),
    actualSuppliesSpend:     r2(actualSuppliesSpend),
    suppliesDelta,
    suppliesDeltaPct,
    actualAvgSuppliesPerOrder,
    // Bottom line — two basis (see route comment for explanation)
    estimatedNetProfit,   // uses per-order supply estimates, no double-count
    taxReadyProfit,       // Option B: uses actual supplies via business_expenses
    // Order counts
    orderCount,
    paidOrderCount:          paidCount,
    unpaidOrderCount:        unpaidCount,
    partialOrderCount:       partialCount,
    // Time series
    monthly,
    quarterly,
    expenseByCategory: Object.fromEntries(
      Object.entries(expenseByCategory).map(([k, v]) => [k, r2(v)])
    ),
  });
}
