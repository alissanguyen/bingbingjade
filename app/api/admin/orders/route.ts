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
  const from = (page - 1) * limit;

  let query = supabaseAdmin
    .from("orders")
    .select(
      `id, order_number, customer_name, customer_email, customer_phone_snapshot,
       amount_total, currency, status, order_status, source, created_at, notes,
       order_items(id)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  // Approved users see only their own orders
  if (isApproved(session)) {
    query = query.eq("created_by", approvedCreatedBy((session as Extract<SessionUser, { type: "approved" }>).user.id));
  }

  if (status) query = query.eq("order_status", status);

  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data ?? []).map((o) => ({
    ...o,
    item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
    order_items: undefined,
  }));

  return NextResponse.json({ orders, total: count ?? 0, page, limit });
}
