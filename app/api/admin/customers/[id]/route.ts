import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

const VALID_STATUSES = ["good_standing", "frequent_client", "high_risk"];

// GET /api/admin/customers/[id] — fetch full customer with linked orders
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
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
      updated_at,
      orders ( id, order_number, order_status, amount_total, currency, created_at ),
      customer_emails ( id, email, label, created_at ),
      customer_phones ( id, phone, label, created_at ),
      customer_addresses ( id, recipient_name, address_line1, address_line2, city, state_or_region, postal_code, country, created_at )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  return NextResponse.json({ customer: data });
}

// PATCH /api/admin/customers/[id] — update any customer fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    status?: string;
    notes?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.customer_name !== undefined) updates.customer_name = body.customer_name.trim();
  if (body.customer_email !== undefined) updates.customer_email = body.customer_email.trim().toLowerCase();
  if (body.customer_phone !== undefined) updates.customer_phone = body.customer_phone?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select("id, customer_name, customer_email, customer_phone, status, notes, updated_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A customer with this email already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ customer: data });
}
