import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function r2(n: number) { return Math.round(n * 100) / 100; }

function getQuarter(dateStr: string): 1 | 2 | 3 | 4 {
  const m = new Date(dateStr).getMonth() + 1;
  return m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
}

// POST /api/admin/full-accounting/summary
// Recomputes accounting_summaries for all years present in orders/payments.
// Triggered by the "Recalculate" button in the admin UI.
export async function POST() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Pull all data ──────────────────────────────────────────────────────
  const [
    { data: orders },
    { data: payments },
    { data: expenses },
    { data: settingsRow },
  ] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(`
        id, amount_total, discount_amount_cents, inventory_expense_amount, inventory_expense_source, created_at,
        fee_breakdown,
        order_fulfillment_costs(label_cost_usd, business_shipping_insurance_cost_usd, supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd)
      `)
      .neq("order_status", "order_cancelled")
      .not("amount_total", "is", null),
    supabaseAdmin
      .from("order_payments")
      .select("order_id, amount_paid_usd, payment_fee_usd, net_received_usd, payment_date, payment_status")
      .in("payment_status", ["paid", "partially_refunded"]),
    supabaseAdmin
      .from("business_expenses")
      .select("amount_usd, deductible_amount_usd, category, expense_date"),
    supabaseAdmin
      .from("accounting_settings")
      .select("default_supplies_cost_per_order")
      .limit(1)
      .maybeSingle(),
  ]);

  const defaultSuppliesPerOrder = Number(settingsRow?.default_supplies_cost_per_order ?? 20);

  // Per-order paid amounts (for reconciliation)
  const orderPaidMap: Record<string, number> = {};
  for (const p of payments ?? []) {
    if (p.order_id) orderPaidMap[p.order_id as string] = (orderPaidMap[p.order_id as string] ?? 0) + Number(p.amount_paid_usd);
  }

  // ── 2. Bucket accumulators ────────────────────────────────────────────────
  // Key: "YYYY-MM" | "YYYY-Qq" | "YYYY"
  type Bucket = {
    gross_sales: number; discounts: number; tax_collected: number;
    cash_received: number; payment_fees: number; net_cash_received: number;
    cogs: number; fulfillment: number; fulfillment_ex_supplies: number;
    supplies_estimate: number; supplies_actual: number;
    order_count: number; paid_count: number; unpaid_count: number; partial_count: number;
  };
  const buckets: Record<string, Bucket> = {};

  function getBucket(key: string): Bucket {
    if (!buckets[key]) {
      buckets[key] = {
        gross_sales: 0, discounts: 0, tax_collected: 0,
        cash_received: 0, payment_fees: 0, net_cash_received: 0,
        cogs: 0, fulfillment: 0, fulfillment_ex_supplies: 0,
        supplies_estimate: 0, supplies_actual: 0,
        order_count: 0, paid_count: 0, unpaid_count: 0, partial_count: 0,
      };
    }
    return buckets[key];
  }

  // Aggregate orders (revenue/COGS/fulfillment by order.created_at)
  for (const o of orders ?? []) {
    const fees     = (o.fee_breakdown ?? {}) as Record<string, number>;
    const tax      = fees.tax      ?? 0;
    const discount = fees.discount ?? (o.discount_amount_cents ?? 0) / 100;
    const total    = (o.amount_total as number) / 100;

    const expSrc = o.inventory_expense_source as string | null;
    const cogs = (expSrc === "manual" || expSrc === "batch_allocated")
      ? Number(o.inventory_expense_amount ?? 0)
      : 0;

    const fc = ((o.order_fulfillment_costs ?? []) as {
      label_cost_usd: number; business_shipping_insurance_cost_usd: number;
      supplies_cost_usd: number; dropoff_transport_cost_usd: number; other_fulfillment_cost_usd: number;
    }[])[0] ?? null;

    const suppliesEstimate = fc != null ? Number(fc.supplies_cost_usd) : defaultSuppliesPerOrder;
    const fulfillmentEx = fc
      ? fc.label_cost_usd + fc.business_shipping_insurance_cost_usd +
        fc.dropoff_transport_cost_usd + fc.other_fulfillment_cost_usd
      : 0;
    const fulfillment = fulfillmentEx + suppliesEstimate;

    const createdAt = o.created_at as string;
    const month  = createdAt.slice(0, 7);
    const year   = createdAt.slice(0, 4);
    const q      = getQuarter(createdAt);
    const qKey   = `${year}-Q${q}`;

    const totalPaid   = orderPaidMap[o.id as string] ?? 0;
    const orderTotal  = total;
    const isPaid      = totalPaid >= orderTotal - 0.01;
    const isPartial   = !isPaid && totalPaid > 0;

    for (const key of [month, qKey, year]) {
      const b = getBucket(key);
      b.gross_sales            += total;
      b.discounts              += discount;
      b.tax_collected          += tax;
      b.cogs                   += cogs;
      b.fulfillment            += fulfillment;
      b.fulfillment_ex_supplies += fulfillmentEx;
      b.supplies_estimate      += suppliesEstimate;
      b.order_count            += 1;
      if (isPaid)       b.paid_count++;
      else if (isPartial) b.partial_count++;
      else              b.unpaid_count++;
    }
  }

  // Aggregate payments (cash by payment_date)
  for (const p of payments ?? []) {
    const amt  = Number(p.amount_paid_usd);
    const fee  = Number(p.payment_fee_usd);
    const net  = Number(p.net_received_usd);
    const pd   = p.payment_date as string;
    const month = pd.slice(0, 7);
    const year  = pd.slice(0, 4);
    const q     = getQuarter(pd);
    const qKey  = `${year}-Q${q}`;

    for (const key of [month, qKey, year]) {
      const b = getBucket(key);
      b.cash_received     += amt;
      b.payment_fees      += fee;
      b.net_cash_received += net;
    }
  }

  // Aggregate expenses (by expense_date, deductible amount; separate supplies)
  const expByBucket:         Record<string, number> = {};
  const suppliesActualBucket: Record<string, number> = {};

  for (const e of expenses ?? []) {
    const ed     = e.expense_date as string;
    const deduct = Number(e.deductible_amount_usd ?? e.amount_usd);
    const raw    = Number(e.amount_usd);
    const month  = ed.slice(0, 7);
    const year   = ed.slice(0, 4);
    const q      = getQuarter(ed);
    const qKey   = `${year}-Q${q}`;

    for (const key of [month, qKey, year]) {
      expByBucket[key] = (expByBucket[key] ?? 0) + deduct;
      if ((e.category as string) === "supplies") {
        suppliesActualBucket[key] = (suppliesActualBucket[key] ?? 0) + raw;
        // Store actual in bucket
        getBucket(key).supplies_actual += 0; // tracked separately in suppliesActualBucket
      }
    }
  }

  // Re-aggregate supplies_actual into buckets cleanly
  for (const e of expenses ?? []) {
    if ((e.category as string) !== "supplies") continue;
    const ed    = e.expense_date as string;
    const raw   = Number(e.amount_usd);
    const month = ed.slice(0, 7);
    const year  = ed.slice(0, 4);
    const q     = getQuarter(ed);
    const qKey  = `${year}-Q${q}`;
    for (const key of [month, qKey, year]) {
      getBucket(key).supplies_actual += raw;
    }
  }

  // ── 3. Build upsert rows ──────────────────────────────────────────────────
  const rows = Object.entries(buckets).map(([key, b]) => {
    const exp                = expByBucket[key] ?? 0;
    const outstanding        = r2(b.gross_sales - b.cash_received);
    const nonSuppliesExp     = exp - (suppliesActualBucket[key] ?? 0);

    // Tax-ready profit (Option B): actual supplies via expenses, per-order estimate excluded from fulfillment
    const taxReadyProfit     = r2(b.net_cash_received - b.tax_collected - b.cogs - b.fulfillment_ex_supplies - exp);
    // Estimated profit: per-order estimates in fulfillment, no actual supplies in expense deduction
    const estimatedProfit    = r2(b.net_cash_received - b.tax_collected - b.cogs - b.fulfillment - nonSuppliesExp);

    const suppliesDelta      = r2(b.supplies_actual - b.supplies_estimate);

    let period_type: "month" | "quarter" | "year";
    let period_year: number;
    let period_quarter: number | null = null;
    let period_month: number | null   = null;

    if (/^\d{4}$/.test(key)) {
      period_type    = "year";
      period_year    = Number(key);
    } else if (/^\d{4}-Q\d$/.test(key)) {
      period_type    = "quarter";
      period_year    = Number(key.slice(0, 4));
      period_quarter = Number(key.slice(6));
    } else {
      period_type    = "month";
      period_year    = Number(key.slice(0, 4));
      period_month   = Number(key.slice(5, 7));
    }

    return {
      period_type,
      period_label:              key,
      period_year,
      period_quarter,
      period_month,
      gross_sales:               r2(b.gross_sales),
      discounts:                 r2(b.discounts),
      tax_collected:             r2(b.tax_collected),
      cash_received:             r2(b.cash_received),
      payment_fees:              r2(b.payment_fees),
      net_cash_received:         r2(b.net_cash_received),
      outstanding_balance:       outstanding,
      cogs:                      r2(b.cogs),
      fulfillment_costs:         r2(b.fulfillment),
      fulfillment_ex_supplies:   r2(b.fulfillment_ex_supplies),
      business_expenses:         r2(exp),
      estimated_profit:          estimatedProfit,
      tax_ready_profit:          taxReadyProfit,
      // Supplies reconciliation
      estimated_supplies_cost:   r2(b.supplies_estimate),
      actual_supplies_spend:     r2(b.supplies_actual),
      supplies_delta:            suppliesDelta,
      default_supplies_per_order: defaultSuppliesPerOrder,
      // Order counts
      order_count:               b.order_count,
      paid_order_count:          b.paid_count,
      unpaid_order_count:        b.unpaid_count,
      partial_order_count:       b.partial_count,
      last_calculated_at:        new Date().toISOString(),
    };
  });

  if (rows.length === 0) {
    return NextResponse.json({ message: "No data to summarize", periods: 0 });
  }

  // Upsert in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabaseAdmin
      .from("accounting_summaries")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "period_type,period_label" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "Recalculated",
    periods: rows.length,
    calculatedAt: new Date().toISOString(),
  });
}
