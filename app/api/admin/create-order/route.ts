/**
 * POST /api/admin/create-order
 *
 * Manually create an order for non-Stripe purchases:
 * WhatsApp orders, cash sales, custom/bespoke commissions, admin-entered orders.
 *
 * Auth: requires admin_session cookie.
 *
 * Body (JSON):
 *   // Customer — provide customerId OR (customerName + customerEmail)
 *   customerId?       string   — existing customer UUID
 *   customerName?     string   — required if no customerId
 *   customerEmail?    string   — required if no customerId
 *   customerPhone?    string
 *
 *   // Order metadata
 *   source            'whatsapp' | 'cash' | 'custom' | 'admin'  (required)
 *   paidStatus?       'paid' | 'unpaid'                          (default: 'paid')
 *   orderStatus?      OrderStatus                                 (default: 'order_confirmed' if paid, 'order_created' if unpaid)
 *   notes?            string
 *   estimatedDeliveryDate?  string   — ISO date YYYY-MM-DD
 *   currency?         string   — default 'usd'
 *
 *   // Items (required, non-empty)
 *   items: [{
 *     productName   string   required (snapshot)
 *     optionLabel?  string
 *     price         number   USD
 *     quantity?     number   default 1
 *     productId?    string   internal UUID (optional — for cross-reference)
 *     optionId?     string   internal UUID (optional)
 *   }]
 *
 *   // Shipping (optional)
 *   shippingAddress?: {
 *     recipientName?  string
 *     line1           string  required
 *     line2?          string
 *     city            string  required
 *     state           string  required
 *     postal          string  required
 *     country?        string  default 'US'
 *   }
 *
 *   // Optional fees (added to order total)
 *   fees?: { shipping?, tax?, paypal?, other?, otherLabel? }
 *
 * Response: { order: { id, order_number, customer_id } }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  upsertCustomer,
  saveShippingAddress,
  generateOrderNumber,
  sendOrderConfirmationEmail,
} from "@/lib/orders";
import type { OrderStatus, OrderSource } from "@/types/orders";

const VALID_SOURCES: OrderSource[] = ["whatsapp", "cash", "custom", "admin"];
const VALID_ORDER_STATUSES: OrderStatus[] = [
  "order_created", "order_confirmed", "in_production", "polishing",
  "quality_control", "certifying", "inbound_shipping", "outbound_shipping", "delivered",
];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  return !!session && session === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    source: OrderSource;
    paidStatus?: "paid" | "unpaid";
    orderStatus?: OrderStatus;
    notes?: string;
    estimatedDeliveryDate?: string;
    currency?: string;
    orderType?: "standard" | "custom";
    items: {
      productName: string;
      optionLabel?: string | null;
      price: number;
      quantity?: number;
      productId?: string;
      optionId?: string;
    }[];
    existingShippingAddressId?: string;
    shippingAddress?: {
      recipientName?: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal: string;
      country?: string;
    };
    fees?: {
      shipping?: number;
      tax?: number;
      paypal?: number;
      other?: number;
      otherLabel?: string;
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Validate source ───────────────────────────────────────────────────────
  if (!body.source || !VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  // ── Validate items ────────────────────────────────────────────────────────
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one item is required." }, { status: 400 });
  }
  for (const item of body.items) {
    if (!item.productName) return NextResponse.json({ error: "Each item must have a productName." }, { status: 400 });
    if (typeof item.price !== "number" || item.price < 0) return NextResponse.json({ error: "Each item must have a valid price." }, { status: 400 });
  }

  // ── Validate optional orderStatus ─────────────────────────────────────────
  if (body.orderStatus && !VALID_ORDER_STATUSES.includes(body.orderStatus)) {
    return NextResponse.json({ error: `Invalid orderStatus.` }, { status: 400 });
  }

  // ── Resolve customer ──────────────────────────────────────────────────────
  let customerId: string | null = null;

  if (body.customerId) {
    customerId = body.customerId;
  } else if (body.customerName && body.customerEmail) {
    try {
      customerId = await upsertCustomer({
        name: body.customerName.trim(),
        email: body.customerEmail.trim().toLowerCase(),
        phone: body.customerPhone?.trim() ?? null,
      });
    } catch (err) {
      console.error("[create-order] Customer upsert failed:", err);
      return NextResponse.json({ error: "Failed to create/find customer." }, { status: 500 });
    }
  }
  // customerId can be null for anonymous/walk-in orders

  // ── Save shipping address ─────────────────────────────────────────────────
  let shippingAddressId: string | null = null;
  if (body.existingShippingAddressId) {
    shippingAddressId = body.existingShippingAddressId;
  } else if (customerId && body.shippingAddress) {
    const sa = body.shippingAddress;
    if (sa.line1 && sa.city && sa.state && sa.postal) {
      try {
        shippingAddressId = await saveShippingAddress({
          customerId,
          recipientName: sa.recipientName ?? null,
          line1: sa.line1,
          line2: sa.line2 ?? null,
          city: sa.city,
          state: sa.state,
          postal: sa.postal,
          country: sa.country ?? "US",
        });
      } catch (err) {
        console.error("[create-order] Address save failed (non-fatal):", err);
      }
    }
  }

  // ── Generate order number ─────────────────────────────────────────────────
  let orderNumber: string | null = null;
  try {
    orderNumber = await generateOrderNumber();
  } catch (err) {
    console.error("[create-order] Order number generation failed (non-fatal):", err);
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const paidStatus = body.paidStatus ?? "paid";
  const orderStatus: OrderStatus =
    body.orderStatus ?? (paidStatus === "paid" ? "order_confirmed" : "order_created");
  const itemsTotal = body.items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0);
  const feesTotal = (body.fees?.shipping ?? 0) + (body.fees?.tax ?? 0) + (body.fees?.paypal ?? 0) + (body.fees?.other ?? 0);
  const amountTotalCents = Math.round((itemsTotal + feesTotal) * 100);

  // ── Insert order ──────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: customerId,
      customer_email: body.customerEmail?.trim().toLowerCase() ?? null,
      customer_name: body.customerName?.trim() ?? null,
      customer_phone_snapshot: body.customerPhone?.trim() ?? null,
      amount_total: amountTotalCents,
      currency: body.currency ?? "usd",
      status: paidStatus,
      order_status: orderStatus,
      source: body.source,
      order_type: body.orderType ?? "standard",
      notes: body.notes ?? null,
      estimated_delivery_date: body.estimatedDeliveryDate ?? null,
      shipping_address_id: shippingAddressId,
      fee_breakdown: body.fees && Object.keys(body.fees).filter((k) => k !== "otherLabel" && (body.fees as Record<string, unknown>)[k]).length > 0
        ? body.fees
        : null,
      // No stripe fields — this is a manual order
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("[create-order] Order insert failed:", orderErr);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // ── Insert order items ────────────────────────────────────────────────────
  const itemRows = body.items.map((item) => {
    const qty = item.quantity ?? 1;
    return {
      order_id: order.id,
      product_id: item.productId ?? null,
      product_option_id: item.optionId ?? null,
      product_name: item.productName,
      option_label: item.optionLabel ?? null,
      price_usd: item.price,
      quantity: qty,
      line_total: item.price * qty,
    };
  });

  const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(itemRows);
  if (itemsErr) {
    console.error("[create-order] Order items insert failed:", itemsErr);
    // Order was created — log and continue (don't fail the whole request)
  }

  // ── Send confirmation email ───────────────────────────────────────────────
  const emailRecipient = body.customerEmail?.trim().toLowerCase();
  const emailName = body.customerName?.trim();
  if (orderNumber && emailName && emailRecipient) {
    await sendOrderConfirmationEmail({
      orderNumber,
      customerName: emailName,
      customerEmail: emailRecipient,
      amountTotalCents,
      items: body.items.map((i) => ({
        name: i.productName,
        option: i.optionLabel ?? null,
        price: i.price,
        quantity: i.quantity ?? 1,
      })),
      estimatedDelivery: body.estimatedDeliveryDate ?? null,
    });
  }

  console.info("[create-order] Manual order created", order.id, orderNumber ?? "(no number)", "source:", body.source);

  return NextResponse.json({
    order: {
      id: order.id,
      order_number: orderNumber,
      customer_id: customerId,
    },
  });
}
