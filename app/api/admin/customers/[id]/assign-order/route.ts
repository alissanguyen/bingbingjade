import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

// POST /api/admin/customers/[id]/assign-order
// Links an order to this customer (sets orders.customer_id) and resyncs order count.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { orderId?: string };

  if (!body.orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  // Link the order
  const { error: linkErr } = await supabaseAdmin
    .from("orders")
    .update({ customer_id: id })
    .eq("id", body.orderId);

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // Resync number_of_orders from the actual linked order count
  const { count } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);

  await supabaseAdmin
    .from("customers")
    .update({ number_of_orders: count ?? 0, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
