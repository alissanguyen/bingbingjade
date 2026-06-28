import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";

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
    order_items: { id: string; price_usd: number; quantity: number }[];
    [key: string]: unknown;
  };
  const orders = ((data ?? []) as unknown as RawOrder[]).map((o) => {
    const items = Array.isArray(o.order_items)
      ? o.order_items
      : [];
    const item_subtotal = items.reduce((s, i) => s + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
    return {
      ...o,
      item_count: items.length,
      item_subtotal,
      order_items: undefined,
      shipments: undefined,
    };
  });

  return NextResponse.json({ orders, total: count ?? 0, page, limit });
}
