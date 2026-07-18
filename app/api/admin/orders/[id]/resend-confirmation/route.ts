import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderConfirmationEmail, buildOrderConfirmationHtml, fetchEmailItems, getOrderShippingAddress } from "@/lib/orders";

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

async function fetchOrderAndItems(id: string) {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();
  if (orderErr || !order) return null;

  // Previously derived from order.shipping_address, which this query never
  // actually joins (no customer_addresses alias in the select above) — that
  // silently fell through to shipping_address_json every time, which is only
  // populated for orders without a linked customer. getOrderShippingAddress
  // resolves the linked address correctly and falls back to Stripe recovery.
  const [items, shippingAddress] = await Promise.all([
    fetchEmailItems(order.id),
    getOrderShippingAddress(order.id),
  ]);
  return { order, items, shippingAddress };
}

// GET — return preview HTML without sending
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await fetchOrderAndItems(id);
  if (!result) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { order, items, shippingAddress } = result;
  if (!order.order_number || !order.customer_name || !order.customer_email) {
    return NextResponse.json({ error: "Order is missing number, customer name, or email." }, { status: 400 });
  }

  const { html } = buildOrderConfirmationHtml({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    amountTotalCents: order.amount_total ?? 0,
    items,
    estimatedDelivery: order.estimated_delivery_date ?? null,
    shippingAddress,
  });

  return NextResponse.json({ html });
}

// POST — send the email
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await fetchOrderAndItems(id);
  if (!result) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { order, items, shippingAddress } = result;
  if (!order.order_number || !order.customer_name || !order.customer_email) {
    return NextResponse.json({ error: "Order is missing number, customer name, or email." }, { status: 400 });
  }

  await sendOrderConfirmationEmail({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    amountTotalCents: order.amount_total ?? 0,
    items,
    estimatedDelivery: order.estimated_delivery_date ?? null,
    shippingAddress,
  });

  return NextResponse.json({ ok: true });
}
