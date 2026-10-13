import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";
import {
  computeOrderRevenue,
  groupPaymentsByOrder,
  groupClaimRefundsByOrder,
  type OrderPaymentLedgerRow,
  type ClaimRefundLedgerRow,
} from "@/lib/revenue";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const status = searchParams.get("status") ?? "";
  const search = (searchParams.get("search") ?? "").trim();
  const fulfillment = searchParams.get("fulfillment") ?? "";
  const from = (page - 1) * limit;

  const validFulfillment = fulfillment === "available_now" || fulfillment === "sourced_for_you"
    ? fulfillment : "";

  const selectFields = `id, order_number, customer_name, customer_email, customer_phone_snapshot,
     amount_total, currency, status, order_status, source, created_at, notes,
     store_credit_used_cents,
     order_items(id, price_usd, quantity)${validFulfillment ? ", shipments!inner(fulfillment_type)" : ""}`;

  let query = supabaseAdmin
    .from("orders")
    .select(selectFields, { count: "exact" })
    .order("order_number", { ascending: false, nullsFirst: false })
    .range(from, from + limit - 1);

  // Approved users see only their own orders
  if (isApproved(session)) {
    query = query.eq("created_by", approvedCreatedBy((session as Extract<SessionUser, { type: "approved" }>).user.id));
  }

  if (status) query = query.eq("order_status", status);
  if (validFulfillment) query = query.eq("shipments.fulfillment_type", validFulfillment);

  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RawOrder = {
    id: string;
    amount_total: number | null;
    order_status: string | null;
    store_credit_used_cents: number | null;
    order_items: { id: string; price_usd: number; quantity: number }[];
    [key: string]: unknown;
  };
  const rawOrders = (data ?? []) as unknown as RawOrder[];

  // New Payment (net external revenue) only needs the ledger for orders that
  // actually used store credit — for every other order it's identical to
  // amount_total, so skip the extra queries in the common case.
  const storeCreditOrderIds = rawOrders
    .filter((o) => (o.store_credit_used_cents ?? 0) > 0)
    .map((o) => o.id);

  const paymentsByOrder = new Map<string, OrderPaymentLedgerRow[]>();
  const claimRefundsByOrder = new Map<string, ClaimRefundLedgerRow[]>();
  if (storeCreditOrderIds.length > 0) {
    type PayRow = OrderPaymentLedgerRow & { order_id: string };
    type RefundRow = ClaimRefundLedgerRow & { order_id: string };
    const [{ data: payments }, { data: claimRefunds }] = await Promise.all([
      supabaseAdmin
        .from("order_payments")
        .select("order_id, amount_paid_usd, payment_status")
        .in("order_id", storeCreditOrderIds),
      supabaseAdmin
        .from("claim_refunds")
        .select("order_id, amount_usd, status")
        .in("order_id", storeCreditOrderIds),
    ]);
    for (const [id, rows] of groupPaymentsByOrder((payments ?? []) as PayRow[])) paymentsByOrder.set(id, rows);
    for (const [id, rows] of groupClaimRefundsByOrder((claimRefunds ?? []) as RefundRow[])) claimRefundsByOrder.set(id, rows);
  }

  const orders = rawOrders.map((o) => {
    const items = Array.isArray(o.order_items)
      ? o.order_items
      : [];
    const item_subtotal = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
    const storeCreditUsedCents = o.store_credit_used_cents ?? 0;
    const new_payment_cents = storeCreditUsedCents > 0
      ? computeOrderRevenue(
          { amountTotalCents: o.amount_total, storeCreditUsedCents, orderStatus: o.order_status },
          paymentsByOrder.get(o.id) ?? [],
          claimRefundsByOrder.get(o.id) ?? []
        ).netRevenueCents
      : null;
    return {
      ...o,
      item_count: items.length,
      item_subtotal,
      new_payment_cents,
      order_items: undefined,
      shipments: undefined,
    };
  });

  return NextResponse.json({ orders, total: count ?? 0, page, limit });
}
