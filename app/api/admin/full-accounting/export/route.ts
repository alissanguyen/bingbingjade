import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function escapeCSV(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(fields: unknown[]): string {
  return fields.map(escapeCSV).join(",");
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "orders";
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  let csv = "";
  let filename = "export.csv";

  // ── Orders CSV ────────────────────────────────────────────────────────────
  if (type === "orders") {
    filename = `orders_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let query = supabaseAdmin
      .from("orders")
      .select(`
        id, order_number, created_at, customer_name, customer_email, source,
        order_status, amount_total, discount_amount_cents, cogs_cents, fee_breakdown,
        stripe_session_id, stripe_payment_intent_id,
        order_items(price_usd, quantity, line_total, product_id),
        stripe_accounting_snapshots(stripe_fee_cents, stripe_net_cents, refunded_amount_cents),
        order_fulfillment_costs(label_cost_usd, business_shipping_insurance_cost_usd, supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd)
      `)
      .neq("order_status", "order_cancelled")
      .not("amount_total", "is", null)
      .order("created_at", { ascending: true });

    if (from) query = query.gte("created_at", from);
    if (to)   query = query.lte("created_at", to + "T23:59:59Z");

    const { data: orders } = await query;

    // Product cost map
    const productIds = new Set<string>();
    for (const o of orders ?? []) {
      for (const i of (o.order_items ?? []) as { product_id: string | null }[]) {
        if (i.product_id) productIds.add(i.product_id);
      }
    }
    const pcMap = new Map<string, number>();
    if (productIds.size > 0) {
      const { data: pcs } = await supabaseAdmin
        .from("product_costs")
        .select("product_id, total_cogs_usd")
        .in("product_id", [...productIds]);
      for (const pc of pcs ?? []) pcMap.set(pc.product_id as string, Number(pc.total_cogs_usd) || 0);
    }

    // Payment ledger map
    const orderIds = (orders ?? []).map(o => o.id as string);
    const pmMap: Record<string, { total_paid: number; total_fees: number; providers: string[] }> = {};
    if (orderIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("order_payments")
        .select("order_id, payment_provider, amount_paid_usd, payment_fee_usd, payment_status")
        .in("order_id", orderIds)
        .in("payment_status", ["paid", "partially_refunded"]);
      for (const p of payments ?? []) {
        const oid = p.order_id as string;
        if (!pmMap[oid]) pmMap[oid] = { total_paid: 0, total_fees: 0, providers: [] };
        pmMap[oid].total_paid += Number(p.amount_paid_usd);
        pmMap[oid].total_fees += Number(p.payment_fee_usd);
        const prov = p.payment_provider as string;
        if (!pmMap[oid].providers.includes(prov)) pmMap[oid].providers.push(prov);
      }
    }

    const headers = [
      "Order Number", "Date", "Customer", "Email", "Source", "Status",
      "Listed Subtotal", "Discount", "Actual Item Revenue",
      "Shipping Charged", "Insurance Charged", "Sales Tax",
      "Amount Total", "Total Paid", "Amount Due", "Payment Providers",
      "Payment Fees", "Net Received",
      "Stripe Fee (raw)", "Stripe Net (raw)", "Refunded",
      "COGS", "Missing COGS",
      "Label Cost", "Insurance Cost", "Supplies Cost", "Dropoff Cost",
      "Total Fulfillment", "Estimated Profit",
      "Stripe Session ID", "Stripe PI ID",
    ];
    const csvRows = [headers.join(",")];

    for (const o of orders ?? []) {
      const fees      = (o.fee_breakdown ?? {}) as Record<string, number>;
      const shipping  = fees.shipping  ?? 0;
      const insurance = fees.insurance ?? 0;
      const tax       = fees.tax       ?? 0;
      const feeDisc   = fees.discount  ?? 0;
      const totalDol  = (o.amount_total as number) / 100;
      const items     = (o.order_items ?? []) as { price_usd: number; quantity: number; line_total: number | null; product_id: string | null }[];
      const listedSub = items.reduce((s, i) => s + (i.line_total != null ? Number(i.line_total) : (i.price_usd ?? 0) * (i.quantity ?? 1)), 0);
      const discApplied = (o.discount_amount_cents as number | null) ? (o.discount_amount_cents as number) / 100 : feeDisc;
      const actualItemRev = totalDol - shipping - insurance - tax;

      let cogs = 0; let missingCogs = false;
      if ((o.cogs_cents as number | null) != null) {
        cogs = (o.cogs_cents as number) / 100;
      } else {
        for (const i of items) {
          const c = i.product_id ? (pcMap.get(i.product_id) ?? null) : null;
          if (c != null) cogs += c * (i.quantity ?? 1); else missingCogs = true;
        }
      }

      const snaps = (o.stripe_accounting_snapshots ?? []) as { stripe_fee_cents: number | null; stripe_net_cents: number | null; refunded_amount_cents: number | null }[];
      const snap = snaps[0] ?? null;
      const stripeFeeFallback = snap?.stripe_fee_cents != null ? snap.stripe_fee_cents / 100 : 0;
      const stripeNet = snap?.stripe_net_cents != null ? snap.stripe_net_cents / 100 : "";
      const refunded  = snap?.refunded_amount_cents ? snap.refunded_amount_cents / 100 : 0;

      const pm = pmMap[o.id as string];
      const totalPaid    = pm ? pm.total_paid.toFixed(2) : "";
      const paymentFees  = pm ? pm.total_fees.toFixed(2) : stripeFeeFallback.toFixed(2);
      const netReceived  = pm ? (pm.total_paid - pm.total_fees).toFixed(2) : (stripeNet !== "" ? (stripeNet as number).toFixed(2) : "");
      const amountDue    = pm ? (totalDol - pm.total_paid).toFixed(2) : "";
      const providers    = pm ? pm.providers.join("|") : (snap ? "stripe" : "");

      const fc = ((o.order_fulfillment_costs ?? []) as Record<string, number>[])[0] ?? null;
      const labelCost    = fc?.label_cost_usd                       ?? 0;
      const insCost      = fc?.business_shipping_insurance_cost_usd ?? 0;
      const supCost      = fc?.supplies_cost_usd                    ?? 20;
      const dropCost     = fc?.dropoff_transport_cost_usd           ?? 0;
      const totalFulfill = labelCost + insCost + supCost + dropCost;

      const effectiveFee = pm ? pm.total_fees : stripeFeeFallback;
      const profit = (actualItemRev + shipping + insurance) - tax - effectiveFee - cogs - totalFulfill;

      csvRows.push(toRow([
        o.order_number, (o.created_at as string).slice(0, 10),
        o.customer_name, o.customer_email, o.source, o.order_status,
        listedSub.toFixed(2), discApplied.toFixed(2), actualItemRev.toFixed(2),
        shipping.toFixed(2), insurance.toFixed(2), tax.toFixed(2),
        totalDol.toFixed(2), totalPaid, amountDue, providers,
        paymentFees, netReceived,
        stripeFeeFallback.toFixed(2), stripeNet !== "" ? (stripeNet as number).toFixed(2) : "",
        refunded.toFixed(2),
        cogs.toFixed(2), missingCogs ? "YES" : "no",
        labelCost.toFixed(2), insCost.toFixed(2), supCost.toFixed(2), dropCost.toFixed(2),
        totalFulfill.toFixed(2), missingCogs ? "" : profit.toFixed(2),
        o.stripe_session_id ?? "", o.stripe_payment_intent_id ?? "",
      ]));
    }
    csv = csvRows.join("\n");
  }

  // ── All Payments CSV ──────────────────────────────────────────────────────
  else if (type === "all-payments") {
    filename = `all_payments_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let q = supabaseAdmin
      .from("order_payments")
      .select(`
        id, bbj_order_code, payment_provider, payment_type,
        provider_transaction_id, provider_receipt_id, provider_invoice_id,
        amount_paid_usd, currency, payment_fee_usd, net_received_usd,
        payment_date, payment_status, proof_url, notes,
        orders(customer_name, customer_email, order_status)
      `)
      .order("payment_date", { ascending: true });
    if (from) q = q.gte("payment_date", from);
    if (to)   q = q.lte("payment_date", to + "T23:59:59Z");

    const { data: rows } = await q;
    const headers = [
      "BBJ Order Code", "Customer", "Email", "Order Status",
      "Payment Provider", "Payment Type", "Amount USD", "Currency",
      "Payment Fee USD", "Net Received USD",
      "Payment Date", "Payment Status",
      "Transaction ID", "Receipt ID", "Invoice ID",
      "Proof URL", "Notes",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const ord = r.orders as unknown as { customer_name: string | null; customer_email: string | null; order_status: string | null } | null;
      lines.push(toRow([
        r.bbj_order_code, ord?.customer_name, ord?.customer_email, ord?.order_status,
        r.payment_provider, r.payment_type, r.amount_paid_usd, r.currency,
        r.payment_fee_usd, r.net_received_usd,
        (r.payment_date as string)?.slice(0, 10), r.payment_status,
        r.provider_transaction_id, r.provider_receipt_id, r.provider_invoice_id,
        r.proof_url, r.notes,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Manual Payments CSV ───────────────────────────────────────────────────
  else if (type === "manual-payments") {
    filename = `manual_payments_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let q = supabaseAdmin
      .from("order_payments")
      .select(`
        id, bbj_order_code, payment_provider, payment_type,
        provider_transaction_id, provider_receipt_id, provider_invoice_id,
        amount_paid_usd, currency, payment_fee_usd, net_received_usd,
        payment_date, payment_status, proof_url, notes,
        orders(customer_name, customer_email, amount_total)
      `)
      .neq("payment_provider", "stripe")
      .order("payment_date", { ascending: true });
    if (from) q = q.gte("payment_date", from);
    if (to)   q = q.lte("payment_date", to + "T23:59:59Z");

    const { data: rows } = await q;
    const headers = [
      "BBJ Order Code", "Customer", "Email", "Order Total USD",
      "Payment Provider", "Payment Type", "Amount USD", "Fee USD", "Net USD",
      "Payment Date", "Payment Status",
      "Transaction ID", "Receipt ID", "Invoice ID",
      "Proof URL", "Notes",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const ord = r.orders as unknown as { customer_name: string | null; customer_email: string | null; amount_total: number | null } | null;
      lines.push(toRow([
        r.bbj_order_code, ord?.customer_name, ord?.customer_email,
        ord?.amount_total != null ? (ord.amount_total / 100).toFixed(2) : "",
        r.payment_provider, r.payment_type, r.amount_paid_usd, r.payment_fee_usd, r.net_received_usd,
        (r.payment_date as string)?.slice(0, 10), r.payment_status,
        r.provider_transaction_id, r.provider_receipt_id, r.provider_invoice_id,
        r.proof_url, r.notes,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Stripe Payments CSV ───────────────────────────────────────────────────
  else if (type === "stripe-payments") {
    filename = `stripe_payments_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let q = supabaseAdmin
      .from("order_payments")
      .select(`
        bbj_order_code, amount_paid_usd, payment_fee_usd, net_received_usd,
        payment_date, payment_status,
        provider_transaction_id, provider_receipt_id,
        orders(customer_name, customer_email, amount_total)
      `)
      .eq("payment_provider", "stripe")
      .order("payment_date", { ascending: true });
    if (from) q = q.gte("payment_date", from);
    if (to)   q = q.lte("payment_date", to + "T23:59:59Z");

    const { data: rows } = await q;
    const headers = [
      "BBJ Order Code", "Customer", "Email", "Order Total USD",
      "Amount USD", "Stripe Fee USD", "Net USD",
      "Payment Date", "Payment Status",
      "Payment Intent ID", "Receipt URL",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const ord = r.orders as unknown as { customer_name: string | null; customer_email: string | null; amount_total: number | null } | null;
      lines.push(toRow([
        r.bbj_order_code, ord?.customer_name, ord?.customer_email,
        ord?.amount_total != null ? (ord.amount_total / 100).toFixed(2) : "",
        r.amount_paid_usd, r.payment_fee_usd, r.net_received_usd,
        (r.payment_date as string)?.slice(0, 10), r.payment_status,
        r.provider_transaction_id, r.provider_receipt_id,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Unreconciled Orders CSV ───────────────────────────────────────────────
  else if (type === "unreconciled") {
    filename = `unreconciled_orders_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let oq = supabaseAdmin
      .from("orders")
      .select("id, order_number, created_at, customer_name, customer_email, amount_total, order_status, source")
      .neq("order_status", "order_cancelled")
      .not("amount_total", "is", null)
      .order("created_at", { ascending: true });
    if (from) oq = oq.gte("created_at", from);
    if (to)   oq = oq.lte("created_at", to + "T23:59:59Z");

    const { data: allOrders } = await oq;
    const allOrderIds = (allOrders ?? []).map(o => o.id as string);
    const pmMap2: Record<string, number> = {};
    if (allOrderIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("order_payments")
        .select("order_id, amount_paid_usd, payment_status")
        .in("order_id", allOrderIds)
        .in("payment_status", ["paid", "partially_refunded"]);
      for (const p of payments ?? []) {
        pmMap2[p.order_id as string] = (pmMap2[p.order_id as string] ?? 0) + Number(p.amount_paid_usd);
      }
    }

    const unreconciled = (allOrders ?? []).filter(o => {
      const orderTotal = (o.amount_total as number) / 100;
      const totalPaid = pmMap2[o.id as string] ?? 0;
      return Math.abs(orderTotal - totalPaid) > 0.01;
    });

    const headers = [
      "Order Number", "Date", "Customer", "Email", "Source", "Status",
      "Order Total USD", "Total Paid USD", "Amount Due USD",
    ];
    const lines = [headers.join(",")];
    for (const o of unreconciled) {
      const orderTotal = (o.amount_total as number) / 100;
      const totalPaid = pmMap2[o.id as string] ?? 0;
      lines.push(toRow([
        o.order_number, (o.created_at as string).slice(0, 10),
        o.customer_name, o.customer_email, o.source, o.order_status,
        orderTotal.toFixed(2), totalPaid.toFixed(2), (orderTotal - totalPaid).toFixed(2),
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Monthly Summary by Provider CSV ───────────────────────────────────────
  else if (type === "monthly-by-provider") {
    filename = `monthly_by_provider_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let q = supabaseAdmin
      .from("order_payments")
      .select("payment_provider, amount_paid_usd, payment_fee_usd, net_received_usd, payment_date, payment_status")
      .in("payment_status", ["paid", "partially_refunded"])
      .order("payment_date", { ascending: true });
    if (from) q = q.gte("payment_date", from);
    if (to)   q = q.lte("payment_date", to + "T23:59:59Z");

    const { data: payments } = await q;

    // Aggregate by month × provider
    const monthProviderMap: Record<string, Record<string, { count: number; amount: number; fees: number; net: number }>> = {};
    for (const p of payments ?? []) {
      const month = (p.payment_date as string).slice(0, 7);
      const prov  = p.payment_provider as string;
      if (!monthProviderMap[month]) monthProviderMap[month] = {};
      if (!monthProviderMap[month][prov]) monthProviderMap[month][prov] = { count: 0, amount: 0, fees: 0, net: 0 };
      monthProviderMap[month][prov].count++;
      monthProviderMap[month][prov].amount += Number(p.amount_paid_usd);
      monthProviderMap[month][prov].fees   += Number(p.payment_fee_usd);
      monthProviderMap[month][prov].net    += Number(p.net_received_usd);
    }

    const headers = ["Month", "Provider", "Count", "Amount USD", "Fees USD", "Net USD"];
    const lines   = [headers.join(",")];
    for (const month of Object.keys(monthProviderMap).sort()) {
      for (const prov of Object.keys(monthProviderMap[month]).sort()) {
        const d = monthProviderMap[month][prov];
        lines.push(toRow([month, prov, d.count, d.amount.toFixed(2), d.fees.toFixed(2), d.net.toFixed(2)]));
      }
    }
    csv = lines.join("\n");
  }

  // ── Product Costs CSV ─────────────────────────────────────────────────────
  else if (type === "product-costs") {
    filename = "product_costs.csv";
    const { data: rows } = await supabaseAdmin
      .from("product_costs")
      .select(`
        product_id, purchase_price_original, purchase_currency, exchange_rate_to_usd,
        purchase_price_usd, import_cost_usd, certification_cost_usd,
        inbound_shipping_cost_usd, other_cost_usd, total_cogs_usd,
        cost_last_updated_at, notes,
        products(name, category, status),
        acct_vendors(vendor_code, vendor_display_name)
      `);

    const headers = [
      "Product Name", "Category", "Status", "Vendor",
      "Purchase Price (Original)", "Currency", "Exchange Rate",
      "Purchase Price USD", "Import Cost", "Certification Cost",
      "Inbound Shipping", "Other Cost", "Total COGS USD",
      "Last Updated", "Notes",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const prod   = r.products as unknown as { name: string; category: string; status: string } | null;
      const vendor = r.acct_vendors as unknown as { vendor_code: string; vendor_display_name: string | null } | null;
      lines.push(toRow([
        prod?.name, prod?.category, prod?.status,
        vendor ? `${vendor.vendor_code}${vendor.vendor_display_name ? " – " + vendor.vendor_display_name : ""}` : "",
        r.purchase_price_original, r.purchase_currency, r.exchange_rate_to_usd,
        r.purchase_price_usd, r.import_cost_usd, r.certification_cost_usd,
        r.inbound_shipping_cost_usd, r.other_cost_usd, r.total_cogs_usd,
        (r.cost_last_updated_at as string)?.slice(0, 10), r.notes,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Fulfillment Costs CSV ─────────────────────────────────────────────────
  else if (type === "fulfillment-costs") {
    filename = `fulfillment_costs_${from ?? "all"}_to_${to ?? "now"}.csv`;
    const { data: rows } = await supabaseAdmin
      .from("order_fulfillment_costs")
      .select(`
        order_id, label_cost_usd, business_shipping_insurance_cost_usd,
        supplies_cost_usd, dropoff_transport_cost_usd, other_fulfillment_cost_usd, notes,
        orders(order_number, created_at, customer_name, order_status, amount_total)
      `);

    const headers = [
      "Order Number", "Date", "Customer", "Status", "Order Total",
      "Label Cost", "Insurance Cost", "Supplies Cost", "Dropoff Cost", "Other Cost",
      "Total Fulfillment Cost", "Notes",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const o = r.orders as unknown as { order_number: string; created_at: string; customer_name: string; order_status: string; amount_total: number } | null;
      const total = r.label_cost_usd + r.business_shipping_insurance_cost_usd +
        r.supplies_cost_usd + r.dropoff_transport_cost_usd + r.other_fulfillment_cost_usd;
      lines.push(toRow([
        o?.order_number, o?.created_at?.slice(0, 10), o?.customer_name, o?.order_status,
        o?.amount_total != null ? (o.amount_total / 100).toFixed(2) : "",
        r.label_cost_usd, r.business_shipping_insurance_cost_usd,
        r.supplies_cost_usd, r.dropoff_transport_cost_usd, r.other_fulfillment_cost_usd,
        total.toFixed(2), r.notes,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Business Expenses CSV ─────────────────────────────────────────────────
  else if (type === "expenses") {
    filename = `business_expenses_${from ?? "all"}_to_${to ?? "now"}.csv`;
    let q = supabaseAdmin
      .from("business_expenses")
      .select("*")
      .order("expense_date", { ascending: true });
    if (from) q = q.gte("expense_date", from);
    if (to)   q = q.lte("expense_date", to);

    const { data: rows } = await q;
    const headers = [
      "Date", "Vendor", "Category", "Amount USD", "Business Use %",
      "Deductible Amount", "Payment Method", "Receipt URL", "Notes",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      lines.push(toRow([
        r.expense_date, r.vendor, r.category, r.amount_usd,
        r.business_use_percent, r.deductible_amount_usd,
        r.payment_method, r.receipt_url, r.notes,
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Tax Summary CSV ───────────────────────────────────────────────────────
  else if (type === "tax-summary") {
    filename = `tax_summary_${from ?? "all"}_to_${to ?? "now"}.csv`;

    let oq = supabaseAdmin
      .from("orders")
      .select("id, amount_total, fee_breakdown, discount_amount_cents, created_at, source")
      .neq("order_status", "order_cancelled")
      .not("amount_total", "is", null)
      .order("created_at");
    if (from) oq = oq.gte("created_at", from);
    if (to)   oq = oq.lte("created_at", to + "T23:59:59Z");

    const { data: orders } = await oq;

    let eq = supabaseAdmin.from("business_expenses").select("amount_usd, deductible_amount_usd, category, expense_date");
    if (from) eq = eq.gte("expense_date", from);
    if (to)   eq = eq.lte("expense_date", to);
    const { data: expenses } = await eq;

    // Payment fees from ledger
    const oIds = (orders ?? []).map(o => o.id as string);
    let totalPaymentFees = 0;
    if (oIds.length > 0) {
      const { data: pmts } = await supabaseAdmin
        .from("order_payments")
        .select("payment_fee_usd, payment_status")
        .in("order_id", oIds)
        .in("payment_status", ["paid", "partially_refunded"]);
      for (const p of pmts ?? []) totalPaymentFees += Number(p.payment_fee_usd);
    }

    let grossRev = 0, taxColl = 0, discTotal = 0;
    for (const o of orders ?? []) {
      const fees = (o.fee_breakdown ?? {}) as Record<string, number>;
      grossRev  += (o.amount_total as number) / 100;
      taxColl   += fees.tax      ?? 0;
      discTotal += fees.discount ?? (o.discount_amount_cents as number ?? 0) / 100;
    }
    const expTotal = (expenses ?? []).reduce((s, e) => s + Number(e.deductible_amount_usd ?? e.amount_usd), 0);

    const lines = [
      toRow(["Metric", "Amount USD"]),
      toRow(["Gross Revenue", grossRev.toFixed(2)]),
      toRow(["Discounts Given", discTotal.toFixed(2)]),
      toRow(["Net Revenue After Discounts", (grossRev - discTotal).toFixed(2)]),
      toRow(["Sales Tax Collected", taxColl.toFixed(2)]),
      toRow(["Taxable Revenue", (grossRev - discTotal - taxColl).toFixed(2)]),
      toRow([]),
      toRow(["Total Payment Fees", totalPaymentFees.toFixed(2)]),
      toRow(["Total Deductible Business Expenses", expTotal.toFixed(2)]),
      toRow([]),
      toRow(["Period", `${from ?? "all"} to ${to ?? "now"}`]),
      toRow(["Order Count", String((orders ?? []).length)]),
    ];
    csv = lines.join("\n");
  }

  // ── Quarterly Summary CSV ─────────────────────────────────────────────────
  else if (type === "quarterly-summary") {
    const year = searchParams.get("year");
    filename = year ? `quarterly_summary_${year}.csv` : "quarterly_summary_all.csv";
    let q = supabaseAdmin
      .from("accounting_summaries")
      .select("*")
      .eq("period_type", "quarter")
      .order("period_year", { ascending: true })
      .order("period_quarter", { ascending: true });
    if (year) q = q.eq("period_year", Number(year));
    const { data: rows } = await q;
    const headers = [
      "Year", "Quarter", "Label",
      "Gross Sales", "Discounts", "Tax Collected",
      "Cash Received", "Payment Fees", "Net Cash Received", "Outstanding Balance",
      "COGS", "Fulfillment Costs (excl. Supplies)", "Business Expenses",
      "Estimated Supplies Cost", "Actual Supplies Spend", "Supplies Delta",
      "Default Supplies/Order",
      "Orders Shipped", "Estimated Profit", "Tax-Ready Profit",
      "Paid", "Partial", "Unpaid",
      "Last Calculated",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const estSupplies = Number(r.estimated_supplies_cost ?? 0);
      const actSupplies = Number(r.actual_supplies_spend   ?? 0);
      const delta       = Number(r.supplies_delta          ?? 0);
      const deltaPct    = estSupplies > 0 ? ((delta / estSupplies) * 100).toFixed(1) + "%" : "";
      const actAvg      = r.order_count > 0 ? (actSupplies / r.order_count).toFixed(2) : "";
      lines.push(toRow([
        r.period_year, r.period_quarter, r.period_label,
        r.gross_sales, r.discounts, r.tax_collected,
        r.cash_received, r.payment_fees, r.net_cash_received, r.outstanding_balance,
        r.cogs,
        r.fulfillment_ex_supplies ?? r.fulfillment_costs,
        r.business_expenses,
        estSupplies.toFixed(2), actSupplies.toFixed(2), delta.toFixed(2),
        r.default_supplies_per_order ?? 20,
        r.order_count, r.estimated_profit, r.tax_ready_profit ?? r.estimated_profit,
        r.paid_order_count, r.partial_order_count, r.unpaid_order_count,
        (r.last_calculated_at as string)?.slice(0, 10),
      ]));
      void deltaPct; void actAvg; // available for future use
    }
    csv = lines.join("\n");
  }

  // ── Monthly Summary CSV ───────────────────────────────────────────────────
  else if (type === "monthly-summary") {
    filename = `monthly_summary_${from ?? "all"}_to_${to ?? "now"}.csv`;
    let q = supabaseAdmin
      .from("accounting_summaries")
      .select("*")
      .eq("period_type", "month")
      .order("period_year", { ascending: true })
      .order("period_month", { ascending: true });
    if (from) q = q.gte("period_label", from.slice(0, 7));
    if (to)   q = q.lte("period_label", to.slice(0, 7));
    const { data: rows } = await q;
    const headers = [
      "Month",
      "Gross Sales", "Discounts", "Tax Collected",
      "Cash Received", "Payment Fees", "Net Cash Received", "Outstanding Balance",
      "COGS", "Fulfillment Costs (excl. Supplies)", "Business Expenses",
      "Estimated Supplies Cost", "Actual Supplies Spend", "Supplies Delta",
      "Default Supplies/Order",
      "Orders Shipped", "Estimated Profit", "Tax-Ready Profit",
      "Paid", "Partial", "Unpaid",
      "Last Calculated",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const estSupplies = Number(r.estimated_supplies_cost ?? 0);
      const actSupplies = Number(r.actual_supplies_spend   ?? 0);
      const delta       = Number(r.supplies_delta          ?? 0);
      lines.push(toRow([
        r.period_label,
        r.gross_sales, r.discounts, r.tax_collected,
        r.cash_received, r.payment_fees, r.net_cash_received, r.outstanding_balance,
        r.cogs,
        r.fulfillment_ex_supplies ?? r.fulfillment_costs,
        r.business_expenses,
        estSupplies.toFixed(2), actSupplies.toFixed(2), delta.toFixed(2),
        r.default_supplies_per_order ?? 20,
        r.order_count, r.estimated_profit, r.tax_ready_profit ?? r.estimated_profit,
        r.paid_order_count, r.partial_order_count, r.unpaid_order_count,
        (r.last_calculated_at as string)?.slice(0, 10),
      ]));
    }
    csv = lines.join("\n");
  }

  // ── Annual Summary CSV ────────────────────────────────────────────────────
  else if (type === "annual-summary") {
    filename = "annual_summary.csv";
    const { data: rows } = await supabaseAdmin
      .from("accounting_summaries")
      .select("*")
      .eq("period_type", "year")
      .order("period_year", { ascending: true });
    const headers = [
      "Year",
      "Gross Sales", "Discounts", "Tax Collected",
      "Cash Received", "Payment Fees", "Net Cash Received", "Outstanding Balance",
      "COGS", "Fulfillment Costs (excl. Supplies)", "Business Expenses",
      "Estimated Supplies Cost", "Actual Supplies Spend", "Supplies Delta",
      "Default Supplies/Order", "Actual Avg Supplies/Order",
      "Orders Shipped", "Estimated Profit", "Tax-Ready Profit",
      "Paid", "Partial", "Unpaid",
      "Last Calculated",
    ];
    const lines = [headers.join(",")];
    for (const r of rows ?? []) {
      const estSupplies = Number(r.estimated_supplies_cost ?? 0);
      const actSupplies = Number(r.actual_supplies_spend   ?? 0);
      const delta       = Number(r.supplies_delta          ?? 0);
      const actAvg      = r.order_count > 0 ? (actSupplies / r.order_count).toFixed(2) : "";
      lines.push(toRow([
        r.period_year,
        r.gross_sales, r.discounts, r.tax_collected,
        r.cash_received, r.payment_fees, r.net_cash_received, r.outstanding_balance,
        r.cogs,
        r.fulfillment_ex_supplies ?? r.fulfillment_costs,
        r.business_expenses,
        estSupplies.toFixed(2), actSupplies.toFixed(2), delta.toFixed(2),
        r.default_supplies_per_order ?? 20, actAvg,
        r.order_count, r.estimated_profit, r.tax_ready_profit ?? r.estimated_profit,
        r.paid_order_count, r.partial_order_count, r.unpaid_order_count,
        (r.last_calculated_at as string)?.slice(0, 10),
      ]));
    }
    csv = lines.join("\n");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
