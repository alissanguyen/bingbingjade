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
    .select("id, customer_name, customer_email, customer_phone, number_of_orders, status, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  // Fetch all related data separately to avoid FK relationship dependencies
  const [{ data: orders }, { data: emails }, { data: phones }, { data: addresses }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, order_number, order_status, amount_total, currency, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("customer_emails")
      .select("id, email, label, created_at")
      .eq("customer_id", id)
      .order("created_at"),
    supabaseAdmin
      .from("customer_phones")
      .select("id, phone, label, created_at")
      .eq("customer_id", id)
      .order("created_at"),
    supabaseAdmin
      .from("customer_addresses")
      .select("id, recipient_name, address_line1, address_line2, city, state_or_region, postal_code, country, is_default, created_at")
      .eq("customer_id", id)
      .order("created_at"),
  ]);

  return NextResponse.json({
    customer: {
      ...data,
      orders: orders ?? [],
      customer_emails: emails ?? [],
      customer_phones: phones ?? [],
      customer_addresses: addresses ?? [],
    },
  });
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
    primaryAddressId?: string;
  };

  // Handle primary address change separately (no customers row update needed)
  if (body.primaryAddressId !== undefined) {
    await supabaseAdmin
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", id);
    await supabaseAdmin
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", body.primaryAddressId)
      .eq("customer_id", id);
    return NextResponse.json({ ok: true });
  }

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
