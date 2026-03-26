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
  "in_production",
  "polishing",
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

  const {
    orderStatus, estimatedDeliveryDate, notes, sendEmail, orderType,
    customerName, customerEmail, customerPhone, orderNumber, createdAt,
    shippingAddress, feeBreakdown, orderItems,
  } = body as {
    orderStatus?: string;
    estimatedDeliveryDate?: string | null;
    notes?: string | null;
    sendEmail?: boolean;
    orderType?: "standard" | "custom";
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string | null;
    orderNumber?: string;
    createdAt?: string | null;
    shippingAddress?: {
      recipientName?: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal: string;
      country?: string;
    };
    feeBreakdown?: { shipping?: number; tax?: number; paypal?: number; insurance?: number; discount?: number; other?: number; otherLabel?: string } | null;
    orderItems?: { id: string; price_usd: number; quantity: number }[];
  };

  if (orderStatus && !VALID_STATUSES.includes(orderStatus as OrderStatus)) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
  }

  // Update individual order items first (before recalculating total)
  if (orderItems && orderItems.length > 0) {
    for (const item of orderItems) {
      const lineTotal = parseFloat((item.price_usd * item.quantity).toFixed(2));
      await supabaseAdmin
        .from("order_items")
        .update({ price_usd: item.price_usd, quantity: item.quantity, line_total: lineTotal })
        .eq("id", item.id)
        .eq("order_id", id);
    }
  }

  const updates: Record<string, unknown> = {};
  if (orderStatus !== undefined) updates.order_status = orderStatus;
  if (estimatedDeliveryDate !== undefined) updates.estimated_delivery_date = estimatedDeliveryDate || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (orderType !== undefined) updates.order_type = orderType;
  if (customerName !== undefined) updates.customer_name = customerName.trim() || null;
  if (customerEmail !== undefined) updates.customer_email = customerEmail.trim().toLowerCase() || null;
  if (customerPhone !== undefined) updates.customer_phone_snapshot = customerPhone?.trim() || null;
  if (orderNumber !== undefined) updates.order_number = orderNumber.trim().toUpperCase() || null;
  if (createdAt !== undefined && createdAt) updates.created_at = new Date(createdAt).toISOString();
  if (feeBreakdown !== undefined) updates.fee_breakdown = feeBreakdown;

  // Recalculate amount_total whenever items or fees change
  if (orderItems || feeBreakdown !== undefined) {
    const { data: currentItems } = await supabaseAdmin
      .from("order_items")
      .select("price_usd, quantity, line_total")
      .eq("order_id", id);
    const itemsSubtotal = (currentItems ?? []).reduce(
      (s, i) => s + (i.line_total != null ? Number(i.line_total) : (i.price_usd ?? 0) * i.quantity), 0
    );
    // Use the incoming feeBreakdown if provided; otherwise fetch the existing one
    let effectiveFees = feeBreakdown;
    if (feeBreakdown === undefined) {
      const { data: existing } = await supabaseAdmin.from("orders").select("fee_breakdown").eq("id", id).single();
      effectiveFees = (existing?.fee_breakdown as typeof feeBreakdown) ?? null;
    }
    const feesTotal = (effectiveFees?.shipping ?? 0) + (effectiveFees?.tax ?? 0)
      + (effectiveFees?.paypal ?? 0) + (effectiveFees?.insurance ?? 0) - (effectiveFees?.discount ?? 0) + (effectiveFees?.other ?? 0);
    updates.amount_total = Math.round((itemsSubtotal + feesTotal) * 100);
  }

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

  // Update or create shipping address
  if (shippingAddress && shippingAddress.line1?.trim()) {
    const addrData = {
      recipient_name: shippingAddress.recipientName?.trim() || null,
      address_line1: shippingAddress.line1.trim(),
      address_line2: shippingAddress.line2?.trim() || null,
      city: shippingAddress.city.trim(),
      state_or_region: shippingAddress.state.trim(),
      postal_code: shippingAddress.postal.trim(),
      country: shippingAddress.country?.trim() || "US",
    };
    if ((order as Record<string, unknown>).shipping_address_id) {
      await supabaseAdmin
        .from("customer_addresses")
        .update(addrData)
        .eq("id", (order as Record<string, unknown>).shipping_address_id as string);
    } else if ((order as Record<string, unknown>).customer_id) {
      const { data: newAddr } = await supabaseAdmin
        .from("customer_addresses")
        .insert({ ...addrData, customer_id: (order as Record<string, unknown>).customer_id })
        .select("id")
        .single();
      if (newAddr) {
        await supabaseAdmin.from("orders").update({ shipping_address_id: newAddr.id }).eq("id", id);
      }
    }
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
