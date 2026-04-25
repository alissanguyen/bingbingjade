import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

export const dynamic = "force-dynamic";

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

// GET /api/admin/full-accounting/payments
// Params: search, provider, from, to, page, limit, order_id
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search    = searchParams.get("search")?.trim() ?? "";
  const provider  = searchParams.get("provider");
  const from      = searchParams.get("from");
  const to        = searchParams.get("to");
  const orderId   = searchParams.get("order_id");
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit     = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const offset    = (page - 1) * limit;

  let query = supabaseAdmin
    .from("order_payments")
    .select(`
      id, order_id, bbj_order_code, payment_provider, payment_type,
      provider_transaction_id, provider_receipt_id, provider_invoice_id,
      amount_paid_usd, currency, payment_fee_usd, net_received_usd,
      payment_date, payment_status, proof_url, notes, created_at,
      orders(id, order_number, customer_name, customer_email, amount_total, order_status)
    `, { count: "exact" })
    .order("payment_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (orderId) {
    query = query.eq("order_id", orderId);
  }
  if (provider) {
    query = query.eq("payment_provider", provider);
  }
  if (from) {
    query = query.gte("payment_date", from);
  }
  if (to) {
    query = query.lte("payment_date", to + "T23:59:59Z");
  }

  // Multi-field search: BBJ code, provider transaction/receipt/invoice IDs
  if (search.length >= 2) {
    query = query.or(
      [
        `bbj_order_code.ilike.%${search}%`,
        `provider_transaction_id.ilike.%${search}%`,
        `provider_receipt_id.ilike.%${search}%`,
        `provider_invoice_id.ilike.%${search}%`,
        `notes.ilike.%${search}%`,
      ].join(",")
    );
  }

  const { data: payments, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build per-order summaries for the fetched page
  const orderMap: Record<string, {
    order_id: string;
    bbj_order_code: string | null;
    order_number: string | null;
    customer_name: string | null;
    customer_email: string | null;
    amount_total_usd: number | null;
    order_status: string | null;
    total_paid: number;
    total_fees: number;
    total_net: number;
    amount_due: number | null;
    payment_status: string;
    providers: string[];
    payments: typeof payments;
  }> = {};

  for (const p of payments ?? []) {
    const oid = p.order_id ?? `unlinked_${p.id}`;
    const order = p.orders as unknown as {
      id: string; order_number: string | null; customer_name: string | null;
      customer_email: string | null; amount_total: number | null; order_status: string | null;
    } | null;
    const amountTotalUsd = order?.amount_total != null ? order.amount_total / 100 : null;

    if (!orderMap[oid]) {
      orderMap[oid] = {
        order_id:         p.order_id ?? "",
        bbj_order_code:   p.bbj_order_code,
        order_number:     order?.order_number ?? p.bbj_order_code,
        customer_name:    order?.customer_name ?? null,
        customer_email:   order?.customer_email ?? null,
        amount_total_usd: amountTotalUsd,
        order_status:     order?.order_status ?? null,
        total_paid:       0,
        total_fees:       0,
        total_net:        0,
        amount_due:       null,
        payment_status:   "unpaid",
        providers:        [],
        payments:         [],
      };
    }

    const entry = orderMap[oid];
    const isPaid = ["paid", "partially_refunded"].includes(p.payment_status);
    if (isPaid) {
      entry.total_paid += Number(p.amount_paid_usd);
      entry.total_fees += Number(p.payment_fee_usd);
      entry.total_net  += Number(p.net_received_usd);
    }
    if (!entry.providers.includes(p.payment_provider)) {
      entry.providers.push(p.payment_provider);
    }
    (entry.payments as typeof payments).push(p);
  }

  // Compute amount_due and payment_status per order group
  const orderSummaries = Object.values(orderMap).map((e) => {
    const totalPaid = r2(e.total_paid);
    const amountDue = e.amount_total_usd != null ? r2(e.amount_total_usd - totalPaid) : null;
    let paymentStatus = "unpaid";
    if (e.amount_total_usd != null) {
      if (totalPaid >= e.amount_total_usd - 0.01) paymentStatus = "paid";
      else if (totalPaid > 0) paymentStatus = "partial";
    } else if (totalPaid > 0) {
      paymentStatus = "paid";
    }
    return { ...e, total_paid: totalPaid, total_fees: r2(e.total_fees), total_net: r2(e.total_net), amount_due: amountDue, payment_status: paymentStatus };
  });

  // Aggregate totals for the entire page
  const pageTotals = {
    total_paid: r2((payments ?? []).filter(p => ["paid","partially_refunded"].includes(p.payment_status)).reduce((s, p) => s + Number(p.amount_paid_usd), 0)),
    total_fees: r2((payments ?? []).reduce((s, p) => s + Number(p.payment_fee_usd), 0)),
    total_net:  r2((payments ?? []).filter(p => ["paid","partially_refunded"].includes(p.payment_status)).reduce((s, p) => s + Number(p.net_received_usd), 0)),
  };

  return NextResponse.json({
    payments: payments ?? [],
    orderSummaries,
    pageTotals,
    total: count ?? 0,
    page,
    limit,
  });
}

// POST /api/admin/full-accounting/payments
// Create a manual payment
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    order_id?: string | null;
    bbj_order_code?: string | null;
    payment_provider: string;
    payment_type?: string;
    provider_transaction_id?: string | null;
    provider_receipt_id?: string | null;
    provider_invoice_id?: string | null;
    amount_paid_usd: number;
    currency?: string;
    payment_fee_usd?: number;
    net_received_usd?: number;
    payment_date: string;
    payment_status?: string;
    proof_url?: string | null;
    notes?: string | null;
  };

  // If no order_id but bbj_order_code given, look up the order
  let orderId = body.order_id ?? null;
  let bbjCode = body.bbj_order_code ?? null;

  if (!orderId && bbjCode) {
    const { data: foundOrder } = await supabaseAdmin
      .from("orders")
      .select("id, order_number")
      .ilike("order_number", bbjCode.trim())
      .maybeSingle();
    if (foundOrder) {
      orderId = foundOrder.id;
      bbjCode = foundOrder.order_number;
    }
  } else if (orderId && !bbjCode) {
    const { data: foundOrder } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("id", orderId)
      .maybeSingle();
    bbjCode = foundOrder?.order_number ?? null;
  }

  const amountPaid  = Number(body.amount_paid_usd) || 0;
  const feeUsd      = Number(body.payment_fee_usd ?? 0);
  const netReceived = body.net_received_usd != null
    ? Number(body.net_received_usd)
    : amountPaid - feeUsd;

  const { data, error } = await supabaseAdmin
    .from("order_payments")
    .insert({
      order_id:               orderId,
      bbj_order_code:         bbjCode,
      payment_provider:       body.payment_provider,
      payment_type:           body.payment_type ?? "manual",
      provider_transaction_id: body.provider_transaction_id ?? null,
      provider_receipt_id:    body.provider_receipt_id ?? null,
      provider_invoice_id:    body.provider_invoice_id ?? null,
      amount_paid_usd:        amountPaid,
      currency:               (body.currency ?? "USD").toUpperCase(),
      payment_fee_usd:        feeUsd,
      net_received_usd:       netReceived,
      payment_date:           body.payment_date,
      payment_status:         body.payment_status ?? "paid",
      proof_url:              body.proof_url ?? null,
      notes:                  body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data }, { status: 201 });
}
