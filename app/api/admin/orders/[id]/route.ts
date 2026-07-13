import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderStatusEmail, sendDeliveryDateEmail, fetchEmailItems } from "@/lib/orders";
import { processReferralRewardOnDelivery, ensureReferralCode } from "@/lib/discount";
import { sendReferralInviteEmail, sendReferralRewardEmail } from "@/lib/discount-emails";
import { getSessionUser, isAdmin, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";
import type { OrderStatus } from "@/types/orders";

const VALID_STATUSES: OrderStatus[] = [
  "order_created",
  "order_confirmed",
  "awaiting_vendor_confirmation",
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
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let query = supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items(*),
      shipping_address:customer_addresses(
        recipient_name, address_line1, address_line2,
        city, state_or_region, postal_code, country
      ),
      shipping_address_json
    `)
    .eq("id", id);

  // Approved users can only fetch their own orders
  if (isApproved(session)) {
    query = query.eq("created_by", approvedCreatedBy((session as Extract<SessionUser, { type: "approved" }>).user.id));
  }

  const { data: order, error } = await query.single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Strip server-only cost fields before sending to any client
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cogs_cents: _cogs, imported_price_vnd: _vnd, ...safeOrder } = order as typeof order & { cogs_cents?: unknown; imported_price_vnd?: unknown };
  return NextResponse.json({ order: safeOrder });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only admin can update orders (approved users have read-only order access)
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const {
    orderStatus, paidStatus, estimatedDeliveryDate, notes, sendEmail, orderType,
    customerName, customerEmail, customerPhone, orderNumber, createdAt,
    shippingAddress, feeBreakdown, orderItems, newItems, deleteItemIds,
    inventoryExpenseSource, inventoryExpenseAmount, inventoryExpenseNotes,
    reviewWindowClosed,
  } = body as {
    orderStatus?: string;
    paidStatus?: "paid" | "unpaid";
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
    orderItems?: { id: string; product_id?: string | null; product_name?: string; option_label?: string | null; price_usd: number; quantity: number }[];
    newItems?: { product_id?: string | null; product_name: string; option_label?: string | null; price_usd: number; quantity: number }[];
    deleteItemIds?: string[];
    inventoryExpenseSource?: string | null;
    inventoryExpenseAmount?: number | null;
    inventoryExpenseNotes?: string | null;
    reviewWindowClosed?: boolean;
  };

  if (orderStatus && !VALID_STATUSES.includes(orderStatus as OrderStatus)) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
  }

  // Delete removed items
  if (deleteItemIds && deleteItemIds.length > 0) {
    await supabaseAdmin.from("order_items").delete().in("id", deleteItemIds).eq("order_id", id);
  }

  // Update existing order items (inventory link, price, qty, name, label)
  if (orderItems && orderItems.length > 0) {
    for (const item of orderItems) {
      const lineTotal = parseFloat((item.price_usd * item.quantity).toFixed(2));
      const update: Record<string, unknown> = { price_usd: item.price_usd, quantity: item.quantity, line_total: lineTotal };
      if (item.product_id !== undefined) update.product_id = item.product_id;
      if (item.product_name !== undefined) update.product_name = item.product_name;
      if (item.option_label !== undefined) update.option_label = item.option_label;
      await supabaseAdmin
        .from("order_items")
        .update(update)
        .eq("id", item.id)
        .eq("order_id", id);
    }
  }

  // Insert new items
  if (newItems && newItems.length > 0) {
    await supabaseAdmin.from("order_items").insert(
      newItems.filter((i) => i.product_name.trim()).map((i) => ({
        order_id: id,
        product_id: i.product_id ?? null,
        product_name: i.product_name.trim(),
        option_label: i.option_label?.trim() || null,
        price_usd: i.price_usd,
        quantity: i.quantity,
        line_total: parseFloat((i.price_usd * i.quantity).toFixed(2)),
      }))
    );
  }

  const updates: Record<string, unknown> = {};
  if (orderStatus !== undefined) updates.order_status = orderStatus;
  if (paidStatus !== undefined) updates.status = paidStatus;
  if (estimatedDeliveryDate !== undefined) updates.estimated_delivery_date = estimatedDeliveryDate || null;
  if (notes !== undefined) updates.notes = notes || null;
  if (orderType !== undefined) updates.order_type = orderType;
  if (customerName !== undefined) updates.customer_name = customerName.trim() || null;
  if (customerEmail !== undefined) updates.customer_email = customerEmail.trim().toLowerCase() || null;
  if (customerPhone !== undefined) updates.customer_phone_snapshot = customerPhone?.trim() || null;
  if (orderNumber !== undefined) updates.order_number = orderNumber.trim().toUpperCase() || null;
  if (createdAt !== undefined && createdAt) updates.created_at = new Date(createdAt).toISOString();
  if (feeBreakdown !== undefined) updates.fee_breakdown = feeBreakdown;
  if (inventoryExpenseSource !== undefined) updates.inventory_expense_source = inventoryExpenseSource;
  if (inventoryExpenseAmount !== undefined) updates.inventory_expense_amount = inventoryExpenseAmount;
  if (inventoryExpenseNotes !== undefined) updates.inventory_expense_notes = inventoryExpenseNotes || null;
  if (reviewWindowClosed !== undefined) updates.review_window_closed = reviewWindowClosed;

  // Recalculate amount_total whenever items or fees change
  if (orderItems || newItems || deleteItemIds || feeBreakdown !== undefined) {
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

  const hasItemChanges = (orderItems && orderItems.length > 0) || (newItems && newItems.length > 0) || (deleteItemIds && deleteItemIds.length > 0);
  const hasAddressChange = !!(shippingAddress?.line1?.trim());
  if (Object.keys(updates).length === 0 && !hasItemChanges && !hasAddressChange) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any;
  if (Object.keys(updates).length > 0 || hasItemChanges) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select("*, order_items(*)")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    order = data;
  } else {
    // Address-only change — fetch the current order for downstream logic
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 500 });
    }
    order = data;
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
      // Update existing linked address record
      await supabaseAdmin
        .from("customer_addresses")
        .update(addrData)
        .eq("id", (order as Record<string, unknown>).shipping_address_id as string);
    } else if ((order as Record<string, unknown>).customer_id) {
      // Create new address record linked to the customer
      const { data: newAddr } = await supabaseAdmin
        .from("customer_addresses")
        .insert({ ...addrData, customer_id: (order as Record<string, unknown>).customer_id })
        .select("id")
        .single();
      if (newAddr) {
        await supabaseAdmin.from("orders").update({ shipping_address_id: newAddr.id }).eq("id", id);
      }
    } else {
      // No customer_id — store address as JSON directly on the order
      await supabaseAdmin.from("orders").update({ shipping_address_json: addrData }).eq("id", id);
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

  // ── Post-delivery flows (non-fatal) ────────────────────────────────────────
  if (orderStatus === "delivered" && order.customer_id && order.customer_email) {
    try {
      const customerId = order.customer_id as string;
      const customerEmail = order.customer_email as string;
      const customerName = order.customer_name as string | null;

      // 1. Record first_delivered_order_at on customer
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("first_delivered_order_at, referral_code, customer_name, store_credit_balance")
        .eq("id", customerId)
        .single();

      const isFirstDelivered = !customer?.first_delivered_order_at;

      if (isFirstDelivered) {
        await supabaseAdmin
          .from("customers")
          .update({
            first_delivered_order_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerId);
      }

      // 2. Issue referral reward if this order was placed via a referral code
      const orderRecord = order as Record<string, unknown>;
      const orderReferralId = orderRecord.referral_id as string | null;

      if (orderReferralId) {
        const orderAmountCents = (orderRecord.amount_total as number | null) ?? 0;
        const rewardResult = await processReferralRewardOnDelivery(id, orderReferralId, orderAmountCents);
        if (rewardResult) {
          const { referrerCustomerId, rewardDollars } = rewardResult;
          // Fetch referrer details (balance already updated by processReferralRewardOnDelivery)
          const { data: referrer } = await supabaseAdmin
            .from("customers")
            .select("customer_name, customer_email, store_credit_balance")
            .eq("id", referrerCustomerId)
            .single();

          if (referrer?.customer_email) {
            sendReferralRewardEmail({
              referrerName: referrer.customer_name,
              referrerEmail: referrer.customer_email,
              creditAmountDollars: rewardDollars,
              newCreditBalance: referrer.store_credit_balance ?? rewardDollars,
            }).catch((err) =>
              console.error("[admin-orders] Referral reward email failed (non-fatal):", err)
            );
          }
        }
      }

      // 3. On first delivery: generate referral code + send referral invite email
      if (isFirstDelivered && customerName) {
        try {
          const referralCode = await ensureReferralCode(customerId);
          sendReferralInviteEmail({
            customerName,
            customerEmail,
            referralCode,
            orderNumber: order.order_number ?? "",
          }).catch((err) =>
            console.error("[admin-orders] Referral invite email failed (non-fatal):", err)
          );
        } catch (err) {
          console.error("[admin-orders] Referral code assignment failed (non-fatal):", err);
        }
      }
    } catch (err) {
      console.error("[admin-orders] Post-delivery flows failed (non-fatal):", err);
    }
  }

  // Strip server-only cost fields before sending to any client
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cogs_cents: _cogs, imported_price_vnd: _vnd, ...safeOrder } = order as typeof order & { cogs_cents?: unknown; imported_price_vnd?: unknown };
  return NextResponse.json({ order: safeOrder });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Delete child rows first to avoid FK constraint failures
  await supabaseAdmin.from("order_items").delete().eq("order_id", id);

  const { data: shipmentRows } = await supabaseAdmin
    .from("shipments")
    .select("id")
    .eq("order_id", id);
  for (const s of shipmentRows ?? []) {
    await supabaseAdmin.from("shipment_events").delete().eq("shipment_id", s.id);
    await supabaseAdmin.from("shipment_items").delete().eq("shipment_id", s.id);
  }
  await supabaseAdmin.from("shipments").delete().eq("order_id", id);

  const { error } = await supabaseAdmin.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
