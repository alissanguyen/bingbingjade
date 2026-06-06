import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderConfirmationEmail, buildOrderConfirmationHtml, fetchEmailItems } from "@/lib/orders";

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

  const sa = order.shipping_address ?? order.shipping_address_json ?? null;
  const shippingAddress = sa?.address_line1 ? {
    name: sa.recipient_name ?? null,
    line1: sa.address_line1,
    line2: sa.address_line2 ?? null,
    city: sa.city,
    state: sa.state_or_region ?? null,
    postal: sa.postal_code,
    country: sa.country ?? null,
  } : null;

  const items = await fetchEmailItems(order.id);
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
