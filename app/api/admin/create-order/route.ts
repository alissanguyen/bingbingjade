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
 *   amountPaidCents?  number   — how much was actually collected right now.
 *                                Omit for a normal fully-paid sale (defaults to
 *                                the full order total). 0 = unpaid. Less than
 *                                the total = a deposit/partial payment; the
 *                                remainder shows as outstanding in accounting
 *                                and as "Partially Paid" on the customer's
 *                                order page until more is recorded.
 *   orderStatus?      OrderStatus                                 (default: 'order_confirmed' if any amount paid, 'order_created' if none)
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
 *   // Optional store credit — customer paid (fully or partly) with an
 *   // existing store credit instead of cash (e.g. Zelle for the rest).
 *   // Requires customerEmail to match the credit's owner. Deducted from the
 *   // credit's balance immediately and recorded on the order (store_credit_id
 *   // / store_credit_used_cents) so accounting doesn't double-count it as
 *   // cash received — amountPaidCents defaults to the remainder after this.
 *   storeCreditCode?        string
 *   storeCreditAmountCents? number
 *
 * Response: { order: { id, order_number, customer_id } }
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  upsertCustomer,
  saveShippingAddress,
  generateOrderNumber,
  sendOrderConfirmationEmail,
} from "@/lib/orders";
import { normalizeEmail, reserveStoreCredit, redeemStoreCreditReservation, releaseStoreCreditReservation } from "@/lib/store-credit";
import type { StoreCreditRow } from "@/lib/store-credit";
import { getSessionUser, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";
import type { OrderStatus, OrderSource } from "@/types/orders";

const VALID_SOURCES: OrderSource[] = ["stripe", "paypal", "zelle", "cash", "custom", "admin"];
const VALID_ORDER_STATUSES: OrderStatus[] = [
  "order_created", "order_confirmed", "awaiting_vendor_confirmation", "in_production", "polishing",
  "quality_control", "certifying", "inbound_shipping", "outbound_shipping", "delivered",
];

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    source: OrderSource;
    amountPaidCents?: number;
    storeCreditCode?: string;
    storeCreditAmountCents?: number;
    orderStatus?: OrderStatus;
    notes?: string;
    estimatedDeliveryDate?: string;
    orderNumber?: string;
    orderDate?: string;
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
      bnpl?: number;
      insurance?: number;
      discount?: number;
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

  // ── Generate order number (use provided value or auto-generate) ──────────
  let orderNumber: string | null = body.orderNumber?.trim().toUpperCase() || null;
  if (!orderNumber) {
    try {
      orderNumber = await generateOrderNumber();
    } catch (err) {
      console.error("[create-order] Order number generation failed (non-fatal):", err);
    }
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const itemsTotal = body.items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0);
  const feesTotal = (body.fees?.shipping ?? 0) + (body.fees?.tax ?? 0) + (body.fees?.paypal ?? 0) + (body.fees?.bnpl ?? 0) + (body.fees?.insurance ?? 0) - (body.fees?.discount ?? 0) + (body.fees?.other ?? 0);
  const amountTotalCents = Math.round((itemsTotal + feesTotal) * 100);

  // ── Apply store credit ────────────────────────────────────────────────────
  // Customer paid (fully or partly) with an existing store credit instead of
  // cash — e.g. Zelle for the remainder. Reserved now (balance deducted
  // immediately, matching the Stripe-checkout flow's reserve→redeem pattern)
  // and redeemed once the order row exists below, so a mid-request failure
  // can't leave the credit's balance silently gone.
  let storeCreditRow: StoreCreditRow | null = null;
  let storeCreditUsedCents = 0;
  let storeCreditReservationRef: string | null = null;

  if (body.storeCreditCode?.trim()) {
    const code = body.storeCreditCode.trim().toUpperCase();
    const requestedCents = body.storeCreditAmountCents;
    if (typeof requestedCents !== "number" || requestedCents <= 0) {
      return NextResponse.json({ error: "storeCreditAmountCents must be a positive number when storeCreditCode is provided." }, { status: 400 });
    }
    const resolvedEmailForCredit = body.customerEmail?.trim().toLowerCase();
    if (!resolvedEmailForCredit) {
      return NextResponse.json({ error: "A customer email is required to apply store credit." }, { status: 400 });
    }

    const { data: creditRow } = await supabaseAdmin.from("store_credits").select("*").eq("code", code).maybeSingle();
    if (!creditRow) {
      return NextResponse.json({ error: "Store credit code not found." }, { status: 400 });
    }
    if (normalizeEmail(creditRow.customer_email) !== normalizeEmail(resolvedEmailForCredit)) {
      return NextResponse.json({ error: "This store credit is associated with a different customer email." }, { status: 400 });
    }
    if (creditRow.status === "revoked") {
      return NextResponse.json({ error: "This store credit has been revoked." }, { status: 400 });
    }
    if (creditRow.status === "fully_used" || creditRow.remaining_amount_cents <= 0) {
      return NextResponse.json({ error: "This store credit has already been fully used." }, { status: 400 });
    }
    if (creditRow.expires_at && new Date(creditRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "This store credit has expired." }, { status: 400 });
    }
    if (requestedCents > creditRow.remaining_amount_cents) {
      return NextResponse.json(
        { error: `Store credit only has $${(creditRow.remaining_amount_cents / 100).toFixed(2)} remaining.` },
        { status: 400 }
      );
    }
    if (requestedCents > amountTotalCents) {
      return NextResponse.json({ error: "Store credit amount cannot exceed the order total." }, { status: 400 });
    }

    storeCreditRow = creditRow as StoreCreditRow;
    storeCreditUsedCents = requestedCents;
    storeCreditReservationRef = crypto.randomUUID();
    const reserveResult = await reserveStoreCredit({
      storeCreditId: storeCreditRow.id,
      amountCents: storeCreditUsedCents,
      checkoutReference: storeCreditReservationRef,
    });
    if (!reserveResult.reserved) {
      return NextResponse.json(
        { error: "Failed to reserve store credit — its balance may have just changed. Please retry." },
        { status: 409 }
      );
    }
  }

  // Defaults to the full total minus any store credit applied — a normal
  // one-shot paid sale is the common case, and the store credit portion is
  // already accounted for separately so it must not also be counted as cash.
  const amountPaidCents = typeof body.amountPaidCents === "number"
    ? Math.max(0, Math.min(body.amountPaidCents, amountTotalCents - storeCreditUsedCents))
    : amountTotalCents - storeCreditUsedCents;
  const paidStatus: "paid" | "unpaid" = (amountPaidCents > 0 || storeCreditUsedCents > 0) ? "paid" : "unpaid";
  const orderStatus: OrderStatus =
    body.orderStatus ?? (paidStatus === "paid" ? "order_confirmed" : "order_created");
  const orderCreatedAtIso = body.orderDate ? new Date(body.orderDate).toISOString() : new Date().toISOString();

  // ── Insert order ──────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: orderNumber,
      created_at: orderCreatedAtIso,
      customer_id: customerId,
      customer_email: body.customerEmail?.trim().toLowerCase() ?? null,
      customer_name: body.customerName?.trim() ?? null,
      customer_phone_snapshot: body.customerPhone?.trim() ?? null,
      amount_total: amountTotalCents,
      currency: body.currency ?? "usd",
      status: paidStatus,
      order_status: orderStatus,
      store_credit_id: storeCreditRow?.id ?? null,
      store_credit_used_cents: storeCreditUsedCents,
      source: body.source,
      order_type: body.orderType ?? "standard",
      notes: body.notes ?? null,
      estimated_delivery_date: body.estimatedDeliveryDate ?? null,
      shipping_address_id: shippingAddressId,
      fee_breakdown: body.fees && Object.keys(body.fees).filter((k) => k !== "otherLabel" && (body.fees as Record<string, unknown>)[k]).length > 0
        ? body.fees
        : null,
      created_by: isApproved(session)
        ? approvedCreatedBy((session as Extract<SessionUser, { type: "approved" }>).user.id)
        : "admin",
      // No stripe fields — this is a manual order
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("[create-order] Order insert failed:", orderErr);
    if (storeCreditReservationRef) await releaseStoreCreditReservation(storeCreditReservationRef);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // ── Redeem the store-credit reservation now that the order exists ────────
  if (storeCreditReservationRef) {
    const redeemed = await redeemStoreCreditReservation(storeCreditReservationRef, order.id);
    if (!redeemed) {
      console.error("[create-order] Failed to redeem store-credit reservation for order", order.id, "ref:", storeCreditReservationRef);
    }
  }

  // ── Record what was actually collected ────────────────────────────────────
  // This is the ledger Cash Received / Full Detailed Accounting sum from — a
  // manual order that skips this is invisible to accounting even though
  // orders.status says "paid". Also covers a genuine partial/deposit sale:
  // amountPaidCents can be less than amountTotalCents, and the gap shows up
  // as an outstanding balance (accounting) / "Partially Paid" (customer page)
  // automatically, purely by comparing this row's sum to amount_total.
  if (amountPaidCents > 0) {
    const providerBySource: Record<OrderSource, "stripe" | "paypal" | "zelle" | "bank_transfer" | "cash" | "other"> = {
      stripe: "stripe",
      paypal: "paypal",
      zelle: "zelle",
      wire: "bank_transfer",
      cash: "cash",
      whatsapp: "other",
      custom: "other",
      admin: "other",
      livestream: "other",
    };
    const { error: paymentErr } = await supabaseAdmin.from("order_payments").insert({
      order_id: order.id,
      bbj_order_code: orderNumber,
      payment_provider: providerBySource[body.source] ?? "other",
      payment_type: "manual",
      amount_paid_usd: amountPaidCents / 100,
      currency: (body.currency ?? "usd").toUpperCase(),
      payment_date: orderCreatedAtIso,
      payment_status: "paid",
      notes: [
        amountPaidCents < amountTotalCents - storeCreditUsedCents ? "Manual order — partial payment" : "Manual order",
        storeCreditUsedCents > 0 ? `store credit applied: $${(storeCreditUsedCents / 100).toFixed(2)}` : null,
      ].filter(Boolean).join(" — "),
    });
    if (paymentErr) console.error("[create-order] Failed to record order_payments (non-fatal):", paymentErr);
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

  // ── Mark sold products / options ──────────────────────────────────────────
  // Items with an optionId → mark that specific option as sold.
  // Items with only a productId → mark the product itself as sold.
  const optionIdsToSell = body.items.filter((i) => i.optionId).map((i) => i.optionId!);
  const productIdsToSell = body.items.filter((i) => i.productId && !i.optionId).map((i) => i.productId!);

  if (optionIdsToSell.length > 0) {
    const { error: optErr } = await supabaseAdmin
      .from("product_options")
      .update({ status: "sold" })
      .in("id", optionIdsToSell);
    if (optErr) console.error("[create-order] Failed to mark options as sold:", optErr);
  }

  if (productIdsToSell.length > 0) {
    const { error: prodErr } = await supabaseAdmin
      .from("products")
      .update({ status: "sold" })
      .in("id", productIdsToSell);
    if (prodErr) console.error("[create-order] Failed to mark products as sold:", prodErr);
  }

  // ── Create shipment + timeline events ────────────────────────────────────
  // All manual orders default to sourced_for_you (Zelle/cash/custom pieces).
  if (order) {
    const { data: shipment } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: order.id,
        shipment_number: orderNumber ? `${orderNumber}-S1` : null,
        fulfillment_type: "sourced_for_you",
        status: "confirmed",
      })
      .select("id")
      .single();

    if (shipment) {
      const insertedItems = await supabaseAdmin
        .from("order_items")
        .select("id")
        .eq("order_id", order.id);

      if (insertedItems.data && insertedItems.data.length > 0) {
        await supabaseAdmin.from("shipment_items").insert(
          insertedItems.data.map((i) => ({ shipment_id: shipment.id, order_item_id: i.id }))
        );
      }

      await supabaseAdmin.from("shipment_events").insert([
        { shipment_id: shipment.id, event_key: "confirmed",          label: "Order Confirmed",        description: "Order placed and payment received.",                             sort_order: 0, is_current: true,  is_completed: false, event_time: orderCreatedAtIso },
        { shipment_id: shipment.id, event_key: "quality_inspection", label: "Quality Inspection",     description: "Your piece is being carefully inspected to meet our standards.", sort_order: 1, is_current: false, is_completed: false },
        { shipment_id: shipment.id, event_key: "certification",      label: "Certification",          description: "Your jade is undergoing authentication and certification.",      sort_order: 2, is_current: false, is_completed: false },
        { shipment_id: shipment.id, event_key: "arriving_at_studio", label: "Arriving at Our Studio", description: "Your piece is on its way to our studio for final handling.",    sort_order: 3, is_current: false, is_completed: false },
        { shipment_id: shipment.id, event_key: "shipped",            label: "Shipped",                description: "Your order has been carefully packaged and shipped.",            sort_order: 4, is_current: false, is_completed: false },
        { shipment_id: shipment.id, event_key: "delivered",          label: "Delivered",              description: "Your piece has arrived. We hope it brings you lasting beauty.",  sort_order: 5, is_current: false, is_completed: false },
      ]);
    }
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
      shippingAddress: body.shippingAddress
        ? {
            name: body.shippingAddress.recipientName ?? null,
            line1: body.shippingAddress.line1,
            line2: body.shippingAddress.line2 ?? null,
            city: body.shippingAddress.city,
            state: body.shippingAddress.state,
            postal: body.shippingAddress.postal,
            country: body.shippingAddress.country ?? null,
          }
        : null,
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
