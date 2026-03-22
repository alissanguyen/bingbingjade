import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderStatusEmail, sendDeliveryDateEmail, fetchEmailItems } from "@/lib/orders";
import type { OrderStatus } from "@/types/orders";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

const VALID_STATUSES: OrderStatus[] = [
  "order_created",
  "order_confirmed",
  "quality_control",
  "certifying",
  "inbound_shipping",
  "outbound_shipping",
  "delivered",
  "order_cancelled",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items(*),
      shipping_address:customer_addresses(
        recipient_name, address_line1, address_line2,
        city, state_or_region, postal_code, country
      )
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const { orderStatus, estimatedDeliveryDate, notes, sendEmail } = body as {
    orderStatus?: string;
    estimatedDeliveryDate?: string | null;
    notes?: string | null;
    sendEmail?: boolean;
  };

  if (orderStatus && !VALID_STATUSES.includes(orderStatus as OrderStatus)) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (orderStatus !== undefined) updates.order_status = orderStatus;
  if (estimatedDeliveryDate !== undefined) updates.estimated_delivery_date = estimatedDeliveryDate || null;
  if (notes !== undefined) updates.notes = notes || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Fetch current delivery date before updating so we can detect a change
  let previousDeliveryDate: string | null = null;
  if (estimatedDeliveryDate !== undefined) {
    const { data: current } = await supabaseAdmin
      .from("orders")
      .select("estimated_delivery_date")
      .eq("id", id)
      .single();
    previousDeliveryDate = current?.estimated_delivery_date ?? null;
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  const canEmail = !!(order.customer_name && order.customer_email && order.order_number);

  // Fetch items (with images) once if we'll need them for either email
  const deliveryDateChanged = estimatedDeliveryDate && estimatedDeliveryDate !== previousDeliveryDate;
  const emailItems = canEmail && ((sendEmail && orderStatus) || deliveryDateChanged)
    ? await fetchEmailItems(id)
    : [];

  // Send status change email if requested
  if (sendEmail && orderStatus && canEmail) {
    await sendOrderStatusEmail({
      orderNumber: order.order_number!,
      customerName: order.customer_name!,
      customerEmail: order.customer_email!,
      newStatus: orderStatus as OrderStatus,
      estimatedDelivery: order.estimated_delivery_date ?? null,
      items: emailItems,
    });
  }

  // Auto-send delivery date email whenever it's set or changed
  if (deliveryDateChanged && canEmail) {
    await sendDeliveryDateEmail({
      orderNumber: order.order_number!,
      customerName: order.customer_name!,
      customerEmail: order.customer_email!,
      estimatedDelivery: estimatedDeliveryDate!,
      items: emailItems,
    });
  }

  return NextResponse.json({ order });
}
