import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/customers — list all customers with their order numbers
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const status = searchParams.get("status") ?? "";
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "200"));

  let query = supabaseAdmin
    .from("customers")
    .select(`
      id,
      customer_name,
      customer_email,
      customer_phone,
      number_of_orders,
      status,
      notes,
      created_at,
      orders ( id, order_number )
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customers = (data ?? []).map((c) => ({
    ...c,
    orders: (c.orders ?? [])
      .filter((o: { id: string; order_number: string | null }) => o.order_number)
      .map((o: { id: string; order_number: string | null }) => ({ id: o.id, order_number: o.order_number as string })),
  }));

  return NextResponse.json({ customers });
}

// POST /api/admin/customers — manually add a customer record
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    status?: string;
  };

  if (!body.email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      customer_name: body.name?.trim() ?? "",
      customer_email: body.email.trim().toLowerCase(),
      customer_phone: body.phone?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
      status: body.status ?? "good_standing",
      number_of_orders: 0,
      is_frequent_customer: false,
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? "A customer with this email already exists."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
