/**
 * Order / customer utilities — used by the Stripe webhook and admin API routes.
 *
 * All functions use supabaseAdmin (service-role key) and are server-side only.
 * None of these functions should ever be imported in client components.
 */

import { supabaseAdmin } from "./supabase-admin";
import { resolveFirstImageUrl } from "./storage";
import { stripe } from "./stripe";
import type Stripe from "stripe";
import type { MetaItem } from "./stripe-metadata";
import { commitDiscount, buildShippingFingerprint } from "./discount";

// ── Customer ──────────────────────────────────────────────────────────────────

/**
 * Upsert a customer by email.
 * - Creates a new record on first purchase.
 * - On repeat purchase: increments order count, updates is_frequent_customer.
 * - Returns the internal customer UUID.
 */
export async function upsertCustomer(params: {
  name: string;
  email: string;
  phone?: string | null;
  stripeCustomerId?: string | null;
}): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id, number_of_orders")
    .eq("customer_email", params.email)
    .maybeSingle();

  if (existing) {
    const newCount = existing.number_of_orders + 1;
    await supabaseAdmin
      .from("customers")
      .update({
        number_of_orders: newCount,
        is_frequent_customer: newCount >= 3,
        updated_at: new Date().toISOString(),
        ...(params.stripeCustomerId ? { stripe_customer_id: params.stripeCustomerId } : {}),
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabaseAdmin
    .from("customers")
    .insert({
      customer_name: params.name,
      customer_email: params.email,
      customer_phone: params.phone ?? null,
      stripe_customer_id: params.stripeCustomerId ?? null,
      number_of_orders: 1,
      is_frequent_customer: false,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(`upsertCustomer failed: ${error?.message}`);
  return created.id as string;
}

// ── Shipping address ──────────────────────────────────────────────────────────

/**
 * Save a shipping address for a customer.
 * Each Stripe order address is stored as a new row (no de-duplication for simplicity).
 * Returns the address UUID.
 */
export async function saveShippingAddress(params: {
  customerId: string;
  recipientName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal: string;
  country: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("customer_addresses")
    .insert({
      customer_id: params.customerId,
      recipient_name: params.recipientName ?? null,
      address_line1: params.line1,
      address_line2: params.line2 ?? null,
      city: params.city,
      state_or_region: params.state,
      postal_code: params.postal,
      country: params.country,
      is_default: true,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`saveShippingAddress failed: ${error?.message}`);
  return data.id as string;
}

/**
 * Resolve an order's shipping address for use in transactional emails / admin
 * display. The local order record is always the primary source — Stripe is
 * only consulted as a fallback when nothing is on file locally (e.g. an older
 * order, or a webhook run that didn't complete address persistence).
 *
 * When a fallback recovery from Stripe succeeds, the result is written back
 * to the order (linked customer_addresses row, or shipping_address_json for
 * orders with no linked customer) so subsequent calls read from the DB again.
 *
 * Returns null — and logs a warning — if no address can be found or
 * recovered. Callers should never treat that as a fatal error.
 */
export async function getOrderShippingAddress(orderId: string): Promise<EmailShippingAddress> {
  // Fetched separately from shipping_address_json below — split so a
  // schema issue with one optional column (e.g. an unapplied migration in a
  // given environment) can't take down the whole lookup for the common,
  // guaranteed-present shipping_address_id path.
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, shipping_address_id, stripe_session_id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  // 1. Linked customer_addresses record — the common case.
  if (order.shipping_address_id) {
    const { data: addr } = await supabaseAdmin
      .from("customer_addresses")
      .select("recipient_name, address_line1, address_line2, city, state_or_region, postal_code, country")
      .eq("id", order.shipping_address_id)
      .maybeSingle();
    if (addr?.address_line1) {
      return {
        name: addr.recipient_name ?? null,
        line1: addr.address_line1,
        line2: addr.address_line2 ?? null,
        city: addr.city ?? null,
        state: addr.state_or_region ?? null,
        postal: addr.postal_code ?? null,
        country: addr.country ?? null,
      };
    }
  }

  // 2. JSON fallback — orders placed without a linked customer record.
  // Queried defensively: some environments haven't applied migration_052
  // (which added this column) yet, and a missing column would otherwise
  // fail the whole query rather than just this one field.
  try {
    const { data: jsonRow, error } = await supabaseAdmin
      .from("orders")
      .select("shipping_address_json")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    const json = jsonRow?.shipping_address_json as Record<string, unknown> | null;
    if (json?.address_line1) {
      return {
        name: (json.recipient_name as string | null) ?? null,
        line1: json.address_line1 as string,
        line2: (json.address_line2 as string | null) ?? null,
        city: (json.city as string | null) ?? null,
        state: (json.state_or_region as string | null) ?? null,
        postal: (json.postal_code as string | null) ?? null,
        country: (json.country as string | null) ?? null,
      };
    }
  } catch (err) {
    console.error("[orders] shipping_address_json lookup failed (non-fatal — falling through to Stripe recovery):", err);
  }

  // 3. Recovery from Stripe — only reached when the local record has nothing.
  if (order.stripe_session_id) {
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
        expand: ["customer_details"],
      });
      const shipping = checkoutSession.collected_information?.shipping_details;
      const md = checkoutSession.metadata ?? {};

      const recovered: EmailShippingAddress = shipping?.address?.line1
        ? {
            name: shipping.name ?? checkoutSession.customer_details?.name ?? null,
            line1: shipping.address.line1,
            line2: shipping.address.line2 ?? null,
            city: shipping.address.city ?? null,
            state: shipping.address.state ?? null,
            postal: shipping.address.postal_code ?? null,
            country: shipping.address.country ?? null,
          }
        : md.ship_line1
          ? {
              name: md.ship_name ?? null,
              line1: md.ship_line1,
              line2: md.ship_line2 ?? null,
              city: md.ship_city ?? null,
              state: md.ship_state ?? null,
              postal: md.ship_postal ?? null,
              country: md.ship_country ?? null,
            }
          : null;

      if (recovered?.line1) {
        // Persist so future reads (and future emails) hit the fast path.
        // Failure to persist is non-fatal — still return the recovered
        // address for THIS request even if we couldn't save it for next time.
        try {
          if (order.customer_id) {
            const newId = await saveShippingAddress({
              customerId: order.customer_id,
              recipientName: recovered.name,
              line1: recovered.line1,
              line2: recovered.line2,
              city: recovered.city ?? "",
              state: recovered.state ?? "",
              postal: recovered.postal ?? "",
              country: recovered.country ?? "",
            });
            await supabaseAdmin.from("orders").update({ shipping_address_id: newId }).eq("id", orderId);
          } else {
            const { error: jsonWriteErr } = await supabaseAdmin.from("orders").update({
              shipping_address_json: {
                recipient_name: recovered.name,
                address_line1: recovered.line1,
                address_line2: recovered.line2,
                city: recovered.city,
                state_or_region: recovered.state,
                postal_code: recovered.postal,
                country: recovered.country,
              },
            }).eq("id", orderId);
            if (jsonWriteErr) throw jsonWriteErr;
          }
          console.info("[orders] Recovered shipping address from Stripe for order", order.order_number ?? orderId);
        } catch (persistErr) {
          console.error("[orders] Recovered address from Stripe but failed to persist it (non-fatal):", persistErr);
        }
        return recovered;
      }
    } catch (err) {
      console.error("[orders] Stripe address recovery failed (non-fatal):", err);
    }
  }

  console.warn("[orders] No shipping address on file or recoverable from Stripe for order", order.order_number ?? orderId);
  return null;
}

// ── Order number ──────────────────────────────────────────────────────────────

/**
 * Generate the next BBJ-XXXX order number via a PostgreSQL sequence.
 * The sequence is defined in migration_019 and is concurrent-safe.
 */
export async function generateOrderNumber(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("next_order_number");
  if (error || !data) throw new Error(`generateOrderNumber failed: ${error?.message}`);
  return data as string;
}

// ── Shipments (fulfillment) ───────────────────────────────────────────────────

/**
 * Create shipments (grouped by inventory_type) + their event timelines for an
 * order. Used both by the auto-capture webhook path (Ship Now / legacy orders,
 * immediately after order_items are inserted) and by the manual-capture admin
 * capture route (once a Sourced for You authorization is captured).
 *
 * Idempotent: no-ops if shipments already exist for this order, so it's safe
 * to call from both the admin capture route and the payment_intent.succeeded
 * webhook reconciliation without double-creating fulfillment records.
 */
export async function createShipmentsForOrder(orderId: string, orderNumber: string | null): Promise<void> {
  const { data: existingShipments } = await supabaseAdmin
    .from("shipments")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existingShipments && existingShipments.length > 0) return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("id, inventory_type")
    .eq("order_id", orderId);
  if (!items || items.length === 0) return;

  const groups = new Map<string, string[]>();
  for (const row of items) {
    const t = (row.inventory_type as string) ?? "sourced_for_you";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(row.id as string);
  }

  let shipmentIndex = 1;
  for (const [inventoryType, itemIds] of groups) {
    const { data: shipment } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: orderId,
        shipment_number: orderNumber ? `${orderNumber}-S${shipmentIndex}` : null,
        fulfillment_type: inventoryType,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (shipment) {
      await supabaseAdmin.from("shipment_items").insert(
        itemIds.map((oid) => ({ shipment_id: shipment.id, order_item_id: oid }))
      );

      const confirmedAt = new Date().toISOString();
      const EVENTS_AVAILABLE_NOW = [
        { event_key: "confirmed",  label: "Order Confirmed", description: "Order placed and payment received.",        sort_order: 0, is_current: true,  is_completed: false, event_time: confirmedAt },
        { event_key: "packing",    label: "Packing",         description: "Your piece is being carefully packaged.",   sort_order: 1, is_current: false, is_completed: false },
        { event_key: "shipped",    label: "Shipped",          description: "Your order is on its way to you.",          sort_order: 2, is_current: false, is_completed: false },
        { event_key: "delivered",  label: "Delivered",        description: "Your piece has arrived.",                  sort_order: 3, is_current: false, is_completed: false },
      ];
      const EVENTS_SOURCED = [
        { event_key: "confirmed",          label: "Order Confirmed",        description: "Order placed and payment received.",                             sort_order: 0, is_current: true,  is_completed: false, event_time: confirmedAt },
        { event_key: "quality_inspection", label: "Quality Inspection",     description: "Your piece is being carefully inspected to meet our standards.", sort_order: 1, is_current: false, is_completed: false },
        { event_key: "certification",      label: "Certification",          description: "Your jade is undergoing authentication and certification.",      sort_order: 2, is_current: false, is_completed: false },
        { event_key: "arriving_at_studio", label: "Arriving at Our Studio", description: "Your piece is on its way to our studio for final handling.",    sort_order: 3, is_current: false, is_completed: false },
        { event_key: "shipped",            label: "Shipped",                description: "Your order has been carefully packaged and shipped.",            sort_order: 4, is_current: false, is_completed: false },
        { event_key: "delivered",          label: "Delivered",              description: "Your piece has arrived. We hope it brings you lasting beauty.",  sort_order: 5, is_current: false, is_completed: false },
      ];

      await supabaseAdmin.from("shipment_events").insert(
        (inventoryType === "available_now" ? EVENTS_AVAILABLE_NOW : EVENTS_SOURCED)
          .map((e) => ({ ...e, shipment_id: shipment.id }))
      );
    }
    shipmentIndex++;
  }
}

// ── order_payments ledger ──────────────────────────────────────────────────────

/**
 * Record the realized payment in the order_payments accounting ledger.
 * Fetches the real Stripe fee from the balance transaction (exact amount
 * Stripe charged — accounts for card type, international, etc).
 *
 * Only call this once money has actually moved (auto-capture completion, or
 * a manual-capture order's capture) — full-accounting revenue reporting reads
 * order_payments.payment_status, not orders.status, so authorized-but-not-yet-
 * captured orders correctly stay out of revenue until this runs.
 *
 * Idempotent: only inserts if no row exists yet for this payment intent.
 */
export async function recordOrderPayment(params: {
  orderId: string;
  orderNumber: string | null;
  paymentIntentId: string;
  amountTotalCents: number;
  currency: string;
  createdAtIso: string;
  notes: string;
}): Promise<void> {
  try {
    const amountUsd = params.amountTotalCents / 100;
    let feeUsd = 0;
    let netUsd = amountUsd;
    let receiptUrl: string | null = null;

    try {
      const pi = await stripe.paymentIntents.retrieve(params.paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      const balTxn = charge?.balance_transaction as Stripe.BalanceTransaction | null;
      if (balTxn) {
        feeUsd = balTxn.fee / 100;
        netUsd = balTxn.net / 100;
      }
      receiptUrl = charge?.receipt_url ?? null;
    } catch {
      // Balance transaction may not be settled yet; a later sync will fix it
    }

    const paymentRow = {
      order_id:                params.orderId,
      bbj_order_code:          params.orderNumber,
      payment_provider:        "stripe" as const,
      payment_type:            "checkout",
      provider_transaction_id: params.paymentIntentId,
      provider_receipt_id:     receiptUrl,
      provider_invoice_id:     null as string | null,
      amount_paid_usd:         amountUsd,
      currency:                params.currency.toUpperCase(),
      payment_fee_usd:         feeUsd,
      net_received_usd:        netUsd,
      payment_date:            params.createdAtIso,
      payment_status:          "paid",
      proof_url:               null as string | null,
      notes:                   params.notes,
    };

    const { data: existingPayment } = await supabaseAdmin
      .from("order_payments")
      .select("id")
      .eq("payment_provider", "stripe")
      .eq("provider_transaction_id", params.paymentIntentId)
      .maybeSingle();

    if (!existingPayment) {
      await supabaseAdmin.from("order_payments").insert(paymentRow);
    } else if (feeUsd > 0) {
      await supabaseAdmin
        .from("order_payments")
        .update({ payment_fee_usd: feeUsd, net_received_usd: netUsd, provider_receipt_id: receiptUrl })
        .eq("id", existingPayment.id);
    }
  } catch (err) {
    console.error("[orders] recordOrderPayment failed (non-fatal):", err);
  }
}

// ── Mark product options + parent products as sold ───────────────────────────
// Moved from app/api/stripe/webhook/route.ts so both the webhook and the
// zero-balance (fully store-credit-paid) checkout path can call it.
export async function markItemsAsSold(metaItems: MetaItem[]): Promise<void> {
  // Mark affected options sold first
  await Promise.all(
    metaItems.map((item) =>
      item.optionId
        ? supabaseAdmin.from("product_options").update({ status: "sold" }).eq("id", item.optionId)
        : supabaseAdmin.from("product_options").update({ status: "sold" }).eq("product_id", item.productId)
    )
  );

  // Mark parent product sold when all options are sold (or it has no options)
  const affectedProductIds = [...new Set(metaItems.map((i) => i.productId))];
  await Promise.all(
    affectedProductIds.map(async (productId) => {
      const { data: allOptions } = await supabaseAdmin
        .from("product_options")
        .select("status")
        .eq("product_id", productId);

      const hasOptions = (allOptions?.length ?? 0) > 0;
      const allSold = hasOptions && allOptions!.every((o) => o.status === "sold");

      if (!hasOptions || allSold) {
        await supabaseAdmin.from("products").update({ status: "sold" }).eq("id", productId);
      }
    })
  );
}

// ── Shared "create a product order" logic ─────────────────────────────────────
// Extracted from the webhook's default checkout.session.completed path so the
// same order-creation/fulfillment logic can run either from a completed
// Stripe Checkout Session (the webhook, unchanged behavior) or synchronously
// from the checkout route when store credit covers the full amount due (no
// Stripe session is ever created for a zero-balance order — see
// app/api/stripe/checkout/route.ts).
export interface FinalizeProductOrderParams {
  // Tender / Stripe identity — null for a zero-balance (store-credit-only) order
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  amountTotalCents: number;      // final order total, pre store-credit
  currency: string;
  paymentIsPaid: boolean;        // true for immediate-capture orders that have actually charged

  // Customer & address
  customerEmail: string | null;
  resolvedCustomerName: string | null;
  customerPhone: string | null;
  resolvedAddr: {
    name: string | null; line1: string | null; line2: string | null;
    city: string | null; state: string | null; postal: string | null; country: string | null;
  } | null;

  // Items
  metaItems: MetaItem[];
  productNameMap: Map<string, string>;
  optionLabelMap: Map<string, string | null>;
  cogsCents: number;

  // Pricing breakdown (already computed by the caller — Stripe line-item
  // parsing for the webhook path stays in the webhook; the checkout route
  // already has these numbers directly for the zero-balance path)
  feeBreakdown: Record<string, number | string> | null;
  discountMeta: { source: string; amountCents: number; subtotalBeforeCents: number; campaignId?: string; referrerCustomerId?: string; code?: string } | null;
  shippingInsuranceAccepted: boolean;
  shippingInsuranceDeclinedAcknowledged: boolean;
  merchandiseSubtotalCents: number | null;

  // Manual capture (Sourced for You)
  isManualCapture: boolean;
  capturePaymentMethod: string | null;
  latestStripeStatus: string | null;
  authorizationExpiresAt: string | null;

  // Sourcing credit (Option B financing) passthrough
  sourcingRequestId: string | null;
  sourcingCreditAppliedCents: number;

  // Store credit — new payment method, never mixed into discountMeta
  storeCreditId: string | null;
  storeCreditUsedCents: number;
  storeCreditReservationRef: string | null;
  stripeAmountCents: number; // amount actually sent to Stripe = amountTotalCents - storeCreditUsedCents (0 for zero-balance)
}

export async function finalizeProductOrder(
  params: FinalizeProductOrderParams
): Promise<{ orderId: string; orderNumber: string | null } | null> {
  const {
    stripeSessionId, stripePaymentIntentId, stripeCustomerId, amountTotalCents, currency, paymentIsPaid,
    customerEmail, resolvedCustomerName, customerPhone, resolvedAddr,
    metaItems, productNameMap, optionLabelMap, cogsCents,
    feeBreakdown, discountMeta, shippingInsuranceAccepted, shippingInsuranceDeclinedAcknowledged,
    merchandiseSubtotalCents, isManualCapture, capturePaymentMethod, latestStripeStatus, authorizationExpiresAt,
    sourcingRequestId, sourcingCreditAppliedCents, storeCreditId, storeCreditUsedCents, storeCreditReservationRef,
    stripeAmountCents,
  } = params;

  let customerId: string | null = null;
  if (customerEmail && resolvedCustomerName) {
    try {
      customerId = await upsertCustomer({
        name: resolvedCustomerName,
        email: customerEmail,
        phone: customerPhone,
        stripeCustomerId,
      });
    } catch (err) {
      console.error("[orders] Customer upsert failed (non-fatal):", err);
    }
  }

  // Update customer marketing opt-in if email is in subscribers list
  if (customerId && customerEmail) {
    try {
      const { data: subscriber } = await supabaseAdmin
        .from("email_subscribers")
        .select("id")
        .eq("email", customerEmail)
        .maybeSingle();

      if (subscriber) {
        await supabaseAdmin
          .from("customers")
          .update({
            marketing_opt_in: true,
            marketing_opt_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerId)
          .eq("marketing_opt_in", false);
      }
    } catch (err) {
      console.error("[orders] Marketing opt-in sync failed (non-fatal):", err);
    }
  }

  // Update paid order tracking on the customer record
  if (customerId && customerEmail) {
    try {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("paid_order_count, first_paid_order_at")
        .eq("id", customerId)
        .single();

      if (customer) {
        const newCount = (customer.paid_order_count ?? 0) + 1;
        await supabaseAdmin
          .from("customers")
          .update({
            paid_order_count: newCount,
            first_paid_order_at: customer.first_paid_order_at ?? new Date().toISOString(),
            is_frequent_customer: newCount >= 3,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerId);
      }
    } catch (err) {
      console.error("[orders] Customer paid_order_count update failed (non-fatal):", err);
    }
  }

  let shippingAddressId: string | null = null;
  if (customerId && resolvedAddr?.line1 && resolvedAddr.city && resolvedAddr.postal && resolvedAddr.country) {
    try {
      shippingAddressId = await saveShippingAddress({
        customerId,
        recipientName: resolvedAddr.name ?? null,
        line1: resolvedAddr.line1,
        line2: resolvedAddr.line2 ?? null,
        city: resolvedAddr.city,
        state: resolvedAddr.state ?? "",
        postal: resolvedAddr.postal,
        country: resolvedAddr.country,
      });
    } catch (err) {
      console.error("[orders] Address save failed (non-fatal):", err);
    }
  }

  let orderNumber: string | null = null;
  try {
    orderNumber = await generateOrderNumber();
  } catch (err) {
    console.error("[orders] Order number generation failed (non-fatal):", err);
  }

  const nowIso = new Date().toISOString();

  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      stripe_session_id: stripeSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
      stripe_customer_id: stripeCustomerId,
      order_number: orderNumber,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: resolvedCustomerName,
      customer_phone_snapshot: customerPhone,
      amount_total: amountTotalCents,
      currency,
      status: isManualCapture ? "unpaid" : "paid",
      order_status: isManualCapture ? "awaiting_vendor_confirmation" : "order_confirmed",
      source: "stripe",
      shipping_address_id: shippingAddressId,
      fee_breakdown: feeBreakdown,
      ...(isManualCapture ? {
        capture_status: "authorized",
        authorized_amount: amountTotalCents,
        authorized_at: nowIso,
        authorization_expires_at: authorizationExpiresAt,
        latest_stripe_status: latestStripeStatus ?? "requires_capture",
        capture_payment_method: capturePaymentMethod,
      } : {}),
      discount_source: discountMeta?.source ?? null,
      discount_amount_cents: discountMeta?.amountCents ?? 0,
      subtotal_before_discount_cents: discountMeta?.subtotalBeforeCents ?? null,
      sourcing_credit_applied: sourcingCreditAppliedCents,
      sourcing_request_id: sourcingRequestId,
      cogs_cents: cogsCents > 0 ? cogsCents : null,
      shipping_insurance_accepted: shippingInsuranceAccepted,
      shipping_insurance_declined_acknowledged: shippingInsuranceDeclinedAcknowledged,
      // Store credit — distinct payment method, never mixed into discount_* fields
      store_credit_id: storeCreditId,
      store_credit_used_cents: storeCreditUsedCents,
      merchandise_subtotal_cents: merchandiseSubtotalCents,
      stripe_amount_cents: stripeAmountCents,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    if ((orderErr as { code?: string })?.code === "23505") {
      const { message, details } = orderErr as { message?: string; details?: string };
      console.info(
        "[orders] Duplicate insert for session", stripeSessionId,
        "| constraint:", message,
        "| details:", details
      );
      await markItemsAsSold(metaItems);
      return null;
    }
    console.error("[orders] Failed to create order for session", stripeSessionId, orderErr);
    throw new Error(`finalizeProductOrder: failed to create order: ${orderErr?.message}`);
  }

  // ── Record payment in order_payments ledger ──────────────────────────────────
  // Skipped for manual-capture orders (nothing charged yet) and for
  // zero-balance orders (stripeAmountCents === 0 — nothing was sent to Stripe,
  // so there is no Stripe payment to record; the store-credit ledger is the
  // record of how this order was paid).
  if (!isManualCapture && stripePaymentIntentId && stripeAmountCents > 0 && paymentIsPaid) {
    await recordOrderPayment({
      orderId: order.id,
      orderNumber,
      paymentIntentId: stripePaymentIntentId,
      amountTotalCents: stripeAmountCents,
      currency,
      createdAtIso: nowIso,
      notes: stripeSessionId ? `Stripe Checkout ${stripeSessionId}` : `Stripe payment ${stripePaymentIntentId}`,
    });
  }

  // ── Commit discount (promotional — unrelated to store credit) ────────────────
  if (discountMeta && customerEmail) {
    try {
      const shippingFingerprint =
        discountMeta.source === "welcome"
          ? buildShippingFingerprint(customerPhone, resolvedAddr?.city ?? null, resolvedAddr?.postal ?? null, resolvedAddr?.country ?? null)
          : null;

      const committed = await commitDiscount({
        source: discountMeta.source as "welcome" | "referral" | "campaign" | "store_credit",
        customerEmail,
        customerId,
        orderId: order.id,
        discountAmountCents: discountMeta.amountCents,
        campaignId: discountMeta.campaignId,
        referrerCustomerId: discountMeta.referrerCustomerId,
        referralCode: discountMeta.code,
        shippingFingerprint,
      });

      if (committed.couponRedemptionId || committed.referralId) {
        await supabaseAdmin
          .from("orders")
          .update({
            coupon_redemption_id: committed.couponRedemptionId ?? null,
            referral_id: committed.referralId ?? null,
          })
          .eq("id", order.id);
      }
    } catch (err) {
      console.error("[orders] Discount commit failed (non-fatal):", err);
    }
  }

  // ── Commit sourcing credit (idempotent via checkout_session_id) ──────────────
  if (sourcingRequestId && sourcingCreditAppliedCents > 0 && stripeSessionId) {
    try {
      const { data: existingLedger } = await supabaseAdmin
        .from("sourcing_credit_ledger")
        .select("id")
        .eq("checkout_session_id", stripeSessionId)
        .eq("event_type", "credit_consumed")
        .maybeSingle();

      if (!existingLedger) {
        const { data: sourcingReq } = await supabaseAdmin
          .from("sourcing_requests")
          .select("customer_email, user_id")
          .eq("id", sourcingRequestId)
          .maybeSingle();

        if (sourcingReq) {
          await supabaseAdmin.from("sourcing_credit_ledger").insert({
            sourcing_request_id: sourcingRequestId,
            customer_email: sourcingReq.customer_email,
            user_id: sourcingReq.user_id ?? null,
            event_type: "credit_consumed",
            amount_cents: sourcingCreditAppliedCents,
            currency: "usd",
            order_id: order.id,
            checkout_session_id: stripeSessionId,
            notes: `Applied at checkout for order ${orderNumber ?? order.id}`,
          });

          await supabaseAdmin
            .from("sourcing_requests")
            .update({ credit_claimed_at: null, credit_claimed_session_id: null, updated_at: new Date().toISOString() })
            .eq("id", sourcingRequestId);
        }
      }
    } catch (err) {
      console.error("[orders] Sourcing credit commit failed (non-fatal):", err);
    }
  }

  // ── Create order items ────────────────────────────────────────────────────────
  await supabaseAdmin.from("order_items").insert(
    metaItems.map((item) => {
      const productName = productNameMap.get(item.productId) ?? item.productId;
      const optionLabel = item.optionId ? (optionLabelMap.get(item.optionId) ?? null) : null;
      return {
        order_id: order.id,
        product_id: item.productId,
        product_option_id: item.optionId ?? null,
        product_name: productName,
        option_label: optionLabel,
        price_usd: item.price,
        quantity: 1,
        line_total: item.price,
        inventory_type: item.fulfillmentType ?? "sourced_for_you",
      };
    })
  );

  // ── Create shipments grouped by inventory_type ────────────────────────────────
  if (!isManualCapture) {
    await createShipmentsForOrder(order.id, orderNumber);
  }

  // ── Mark options and products as sold ─────────────────────────────────────────
  await markItemsAsSold(metaItems);

  // ── Redeem the store-credit reservation, if any ───────────────────────────────
  if (storeCreditReservationRef) {
    const { redeemStoreCreditReservation } = await import("./store-credit");
    const redeemed = await redeemStoreCreditReservation(storeCreditReservationRef, order.id);
    if (!redeemed) {
      console.error("[orders] Failed to redeem store-credit reservation for order", order.id, "ref:", storeCreditReservationRef);
    }
  }

  console.info(
    "[orders] Order created",
    order.id,
    orderNumber ? `(${orderNumber})` : "(no order number)",
    stripeSessionId ? `for session ${stripeSessionId}` : "(zero-balance / store credit)",
    "— items:", metaItems.length,
    isManualCapture ? "— manual capture (awaiting vendor confirmation)" : "",
    discountMeta ? `— discount: ${discountMeta.source} $${(discountMeta.amountCents / 100).toFixed(2)}` : "",
    storeCreditUsedCents > 0 ? `— store credit: $${(storeCreditUsedCents / 100).toFixed(2)}` : ""
  );

  // ── Send branded confirmation email ───────────────────────────────────────────
  if (orderNumber && resolvedCustomerName && customerEmail) {
    try {
      const emailItems = await fetchEmailItems(order.id);
      if (isManualCapture) {
        await sendAvailabilityConfirmationEmail({
          orderNumber,
          customerName: resolvedCustomerName,
          customerEmail,
          authorizedAmountCents: amountTotalCents,
          items: emailItems,
          shippingAddress: resolvedAddr ?? null,
        });
      } else {
        await sendOrderConfirmationEmail({
          orderNumber,
          customerName: resolvedCustomerName,
          customerEmail,
          amountTotalCents,
          items: emailItems,
          shippingAddress: resolvedAddr ?? null,
        });
      }
    } catch (err) {
      console.error("[orders] Confirmation email failed (non-fatal):", err);
    }
  }

  // ── Trigger ISR revalidation ──────────────────────────────────────────────────
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  if (revalidateSecret) {
    await fetch(`${siteUrl}/api/revalidate?secret=${revalidateSecret}`, { method: "POST" }).catch(() => {});
  }

  return { orderId: order.id, orderNumber };
}

// ── Confirmation email (Resend) ───────────────────────────────────────────────

import { Resend } from "resend";

/**
 * Send a branded order confirmation email via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY        — from resend.com/api-keys
 *   RESEND_FROM_EMAIL     — verified sender, e.g. "BingBing Jade <orders@bingbingjade.com>"
 *
 * Silently skips if RESEND_API_KEY is not set.
 */
export type OrderConfirmationEmailParams = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amountTotalCents: number;
  items: EmailItem[];
  estimatedDelivery?: string | null;
  shippingAddress?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal?: string | null;
    country?: string | null;
  } | null;
};

// ── Shared shipping-address HTML block ────────────────────────────────────────
// Used by every transactional email that needs to show the customer's address,
// so all of them stay visually/behaviorally consistent — including the
// "never render a blank row or the literal null/undefined" guarantee, handled
// once here via the hasAddress fallback message.
export type EmailShippingAddress = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
} | null | undefined;

function renderShippingAddressBlock(
  sa: EmailShippingAddress,
  fallbackName: string,
  opts: { includeVerifyNotice?: boolean } = {}
): string {
  const addrName = sa?.name ?? fallbackName;
  const hasAddress = !!sa?.line1;
  const line2 = sa?.line2 ? `<br>${sa.line2}` : "";
  const cityLine = [sa?.city, sa?.state, sa?.postal].filter(Boolean).join(", ");
  const country = sa?.country && sa.country !== "US" ? `<br>${sa.country}` : "";

  const addressBox = `
    <!-- Shipping address -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#0369a1;">Shipping To</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#0c4a6e;">${addrName}</p>
          ${hasAddress
            ? `<p style="margin:4px 0 0;font-size:13px;color:#374151;line-height:1.6;">${sa!.line1}${line2}<br>${cityLine}${country}</p>`
            : `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;font-style:italic;">Your shipping address will be confirmed with you directly.</p>`
          }
        </td>
      </tr>
    </table>`;

  if (opts.includeVerifyNotice === false) return addressBox;

  const verifyNotice = `
    <!-- Incorrect info notice -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:12px 18px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            <strong>Please verify your name and shipping address above.</strong>
            If anything is incorrect, reply to this email or contact us at
            <a href="mailto:contact@bingbingjade.com" style="color:#b45309;text-decoration:none;">contact@bingbingjade.com</a>
            before your order ships — we cannot redirect a package once it is in transit.
          </p>
        </td>
      </tr>
    </table>`;

  return addressBox + verifyNotice;
}

export function buildOrderConfirmationHtml(params: OrderConfirmationEmailParams): { html: string; subject: string } {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

  const amountFormatted = `$${(params.amountTotalCents / 100).toFixed(2)}`;
  const trackUrl = `${siteUrl}/orders/${params.orderNumber}`;
  const orderDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const firstName = params.customerName.split(" ")[0];

  const shippingBlock = renderShippingAddressBlock(params.shippingAddress, params.customerName);

  const itemRows = buildItemRowsHtml(params.items);

  const hasAvailableNow = params.items.some((i) => i.fulfillmentType === "available_now");
  const hasSourcedForYou = params.items.some((i) => !i.fulfillmentType || i.fulfillmentType === "sourced_for_you");
  const isMixed = hasAvailableNow && hasSourcedForYou;

  const deliveryNote =
    params.estimatedDelivery
      ? `Estimated delivery: <strong>${params.estimatedDelivery}</strong>`
      : isMixed
        ? "This order contains both <strong>Ship Now</strong> pieces (ships in 2–5 business days) and <strong>Sourced for You</strong> pieces (typically 2–4 weeks). They will ship separately — we will be in touch to coordinate each shipment."
        : hasAvailableNow
          ? "Your piece is in our U.S. inventory and will ship within 2–5 business days. We will send tracking details as soon as it is on its way."
          : "We will be in touch once your order ships. Authentic jade sourcing, certification, and international shipping take time — typically 2–4 weeks.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Order Confirmed</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for your purchase. Your order has been confirmed and our team will personally reach out within 24&ndash;48 hours to confirm your details and coordinate shipping.
            </p>

            <!-- Order number callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">Your Order Number</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#065f46;letter-spacing:0.04em;">${params.orderNumber}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Use this number to track your order or reach out to us.</p>
                </td>
              </tr>
            </table>

            ${shippingBlock}

            <!-- Items -->
            ${itemRows}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td style="padding:10px 0 0;font-size:14px;font-weight:600;color:#111827;">Total paid</td>
                <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#065f46;text-align:right;">${amountFormatted}</td>
              </tr>
            </table>

            <p style="margin:28px 0 8px;font-size:12px;color:#6b7280;">${orderDate}</p>

            <!-- Delivery note -->
            <p style="margin:0 0 28px;font-size:14px;color:#4b5563;line-height:1.6;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
              ${deliveryNote}
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Track Your Order &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
              Questions? Reply to this email or reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a> or WhatsApp — we&rsquo;re always happy to give a personal update.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
              &ensp;&middot;&ensp;<a href="${siteUrl}/rewards" style="color:#9ca3af;text-decoration:none;">Client Rewards</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    html,
    subject: `[Order Placed] Your BingBing Jade Order ${params.orderNumber} is Confirmed`,
  };
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[orders] Resend not configured — skipping confirmation email");
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>";
  const { html, subject } = buildOrderConfirmationHtml(params);

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject,
      html,
    });
    if (error) {
      console.error("[orders] Resend error:", error);
    }
  } catch (err) {
    console.error("[orders] Failed to send confirmation email:", err);
  }
}

// ── Order status update email (Resend) ────────────────────────────────────────

import type { OrderStatus } from "@/types/orders";

const STATUS_META: Record<
  OrderStatus,
  { subject: string; headline: string; badge: string; body: string } | null
> = {
  order_created: null,
  // No generic status email for this state — sendAvailabilityConfirmationEmail
  // is sent directly by the checkout webhook when the order is created.
  awaiting_vendor_confirmation: null,
  in_production: null,
  polishing: null,
  order_confirmed: {
    subject: "Your BingBing Jade Order is Confirmed ✨",
    headline: "Your Order is Confirmed",
    badge: "Confirmed",
    body: "Thank you for your order — everything has been successfully received and confirmed on our end. Your piece is now being prepared with care. Our team will reach out within 24–48 hours to guide you through the next steps. We’re truly excited to begin this process with you.",
  },

  quality_control: {
    subject: "Your Piece is Undergoing Quality Inspection",
    headline: "Quality Inspection in Progress",
    badge: "Quality Control",
    body: "Your piece has entered our quality inspection stage. Each item is carefully examined by hand to ensure it meets the standards we hold for every BingBing Jade piece — no compromises. This step might take up to a few days, and we appreciate your patience as we ensure everything is exactly as it should be.",
  },

  certifying: {
    subject: "We Are Certifying Your Piece",
    headline: "Certification in Progress",
    badge: "Certifying",
    body: "Your piece has successfully passed inspection and is now undergoing certification. This process confirms that your jade is 100% natural Type A jadeite — untreated and authentic. While certification may take a bit, it is one of the most important steps we take to give you complete confidence in your piece.",
  },
  inbound_shipping: {
    subject: "Your Piece is Arriving at Our Studio",
    headline: "On Its Way to Us",
    badge: "Inbound Shipping",
    body: "Your piece is currently on its way to our studio. Once it arrives, we will perform a final in-person check before preparing it for shipment. Everything is moving exactly as planned, and we’ll continue to keep you updated along the way.",
  },
  outbound_shipping: {
    subject: "Your Order is On Its Way to You! 🎉",
    headline: "Your Order Has Shipped",
    badge: "Shipped",
    body: "Exciting news — your BingBing Jade piece has left our hands and is now on its way to you! Keep an eye on your inbox for any tracking details. We cannot wait for it to reach you.",
  },
  delivered: {
    subject: "Your Order Has Been Delivered 💚",
    headline: "Your Piece Has Arrived",
    badge: "Delivered",
    body: "Your BingBing Jade order has been delivered — congratulations! We hope you absolutely love your piece and that it brings you joy for years to come. If you have any questions, notice anything unexpected, or would like to share your experience with us, please do not hesitate to reach out. We would love to hear from you.",
  },
  order_cancelled: {
    subject: "Your BingBing Jade Order Has Been Cancelled",
    headline: "Order Cancelled",
    badge: "Cancelled",
    body: "Your order has been cancelled. We are sorry to see it go — if this was unexpected, or if there is anything we can do to help, please reach out to us directly and we will do our best to make it right.",
  },
};

/**
 * Send an order status update email via Resend.
 * Always sent from notification@bingbingjade.com.
 * Silently skips if RESEND_API_KEY is not set or the status has no customer-facing email.
 */
/**
 * Fetch order items for an order with resolved product image URLs.
 * Use this whenever building items to pass to any email function.
 */
export async function fetchEmailItems(orderId: string): Promise<EmailItem[]> {
  const { data: rows } = await supabaseAdmin
    .from("order_items")
    .select("product_name, option_label, price_usd, quantity, product_id, inventory_type")
    .eq("order_id", orderId);

  if (!rows?.length) return [];

  const productIds = rows.map((r) => r.product_id).filter((id): id is string => !!id);
  let imageMap: Record<string, string> = {};
  let hrefMap: Record<string, string> = {};

  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, images, slug, public_id")
      .in("id", productIds);

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

    const resolved = await Promise.all(
      (products ?? []).map(async (p) => {
        const url = await resolveFirstImageUrl(p.images as string[]);
        return [p.id, url ?? ""] as [string, string];
      })
    );
    imageMap = Object.fromEntries(resolved);

    hrefMap = Object.fromEntries(
      (products ?? [])
        .filter((p) => p.slug && p.public_id)
        .map((p) => [p.id, `${siteUrl}/products/${p.slug}-${p.public_id}`])
    );
  }

  return rows.map((r) => ({
    name: r.product_name,
    option: r.option_label,
    price: r.price_usd ?? 0,
    quantity: r.quantity ?? 1,
    imageUrl: r.product_id ? (imageMap[r.product_id] ?? null) : null,
    href: r.product_id ? (hrefMap[r.product_id] ?? null) : null,
    fulfillmentType: (r.inventory_type as "available_now" | "sourced_for_you" | null) ?? "sourced_for_you",
  }));
}

export type EmailItem = {
  name: string;
  option?: string | null;
  price: number;
  quantity?: number;
  imageUrl?: string | null;
  href?: string | null;
  fulfillmentType?: "available_now" | "sourced_for_you";
};

// Shared helper — same item-row HTML used in all email templates
function buildItemRowsHtml(items: EmailItem[]): string {
  if (!items.length) return "";
  const rows = items
    .map((i) => {
      const qty = i.quantity && i.quantity > 1 ? ` &times; ${i.quantity}` : "";
      const label = i.option ? `${i.name} &mdash; ${i.option}` : i.name;
      const lineTotal = i.price * (i.quantity ?? 1);
      const imgContent = i.imageUrl
        ? `<img src="${i.imageUrl}" width="56" height="56" alt="" style="display:block;border-radius:8px;object-fit:cover;width:56px;height:56px;" />`
        : `<div style="width:56px;height:56px;border-radius:8px;background:#ecfdf5;"></div>`;
      const imgCell = `<td style="width:56px;padding-right:14px;vertical-align:middle;">${
        i.href ? `<a href="${i.href}" style="display:block;text-decoration:none;">${imgContent}</a>` : imgContent
      }</td>`;
      const nameDisplay = i.href
        ? `<a href="${i.href}" style="color:#065f46;text-decoration:none;font-weight:500;">${label}</a>${qty}`
        : `${label}${qty}`;
      return `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0" width="100%"><tr>
              ${imgCell}
              <td style="vertical-align:middle;color:#374151;font-size:14px;">${nameDisplay}</td>
              <td style="vertical-align:middle;text-align:right;white-space:nowrap;color:#374151;font-size:14px;font-weight:600;">$${lineTotal.toFixed(2)}</td>
            </tr></table>
          </td>
        </tr>`;
    })
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding-bottom:8px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Order Summary</td>
      </tr>
      ${rows}
    </table>`;
}

export async function sendOrderStatusEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  newStatus: OrderStatus;
  estimatedDelivery?: string | null;
  items?: EmailItem[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const meta = STATUS_META[params.newStatus];
  if (!meta) return;

  const resend = new Resend(apiKey);
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const trackUrl = `${siteUrl}/orders/${params.orderNumber}`;
  const firstName = params.customerName.split(" ")[0];

  const isCancelled = params.newStatus === "order_cancelled";
  const headerBg = isCancelled ? "#991b1b" : "#065f46";
  const badgeBg = isCancelled ? "#fee2e2" : "#f0fdf4";
  const badgeBorder = isCancelled ? "#fca5a5" : "#bbf7d0";
  const badgeColor = isCancelled ? "#991b1b" : "#059669";
  const orderNumColor = isCancelled ? "#7f1d1d" : "#065f46";

  const deliveryNote =
    !isCancelled && params.estimatedDelivery
      ? `<p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">Estimated delivery: <strong>${params.estimatedDelivery}</strong></p>`
      : "";

  const isDelivered = params.newStatus === "delivered";
  const ctaLabel = isDelivered ? "Leave a Review &rarr;" : "Track Your Order &rarr;";
  const ctaUrl = isDelivered ? `${trackUrl}#review` : trackUrl;
  const ctaSection = !isCancelled
    ? `<table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#065f46;border-radius:999px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:${headerBg};padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Order Update</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${meta.body}</p>

            <!-- Order number callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${badgeBg};border:1px solid ${badgeBorder};border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${badgeColor};">${meta.badge}</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:${orderNumColor};letter-spacing:0.04em;">${params.orderNumber}</p>
                </td>
              </tr>
            </table>

            ${buildItemRowsHtml(params.items ?? [])}
            ${deliveryNote}
            ${ctaSection}

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
              Questions? Reply to this email or reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a> or WhatsApp &mdash; we&rsquo;re always happy to give a personal update.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
              &ensp;&middot;&ensp;<a href="${siteUrl}/rewards" style="color:#9ca3af;text-decoration:none;">Client Rewards</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `[Order Update] ${meta.subject} — ${params.orderNumber}`,
      html,
    });
    if (error) console.error("[orders] Resend status email error:", error);
  } catch (err) {
    console.error("[orders] Failed to send status email:", err);
  }
}

// ── Estimated delivery date update email (Resend) ─────────────────────────────

/**
 * Notify the customer that their estimated delivery date has been set or updated.
 * Sent from notification@bingbingjade.com.
 */
export async function sendDeliveryDateEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  estimatedDelivery: string;
  items?: EmailItem[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const trackUrl = `${siteUrl}/orders/${params.orderNumber}`;
  const firstName = params.customerName.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Delivery Update</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              We have an updated estimated delivery date for your order. Please see the details below.
            </p>

            <!-- Delivery date callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#92400e;">Estimated Delivery</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#78350f;letter-spacing:0.01em;">${params.estimatedDelivery}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Order ${params.orderNumber}</p>
                </td>
              </tr>
            </table>

            ${buildItemRowsHtml(params.items ?? [])}

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Track Your Order &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
              Questions? Reply to this email or reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a> or WhatsApp &mdash; we&rsquo;re always happy to give a personal update.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
              &ensp;&middot;&ensp;<a href="${siteUrl}/rewards" style="color:#9ca3af;text-decoration:none;">Client Rewards</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `[Order Update] Delivery Update for Your Order ${params.orderNumber}`,
      html,
    });
    if (error) console.error("[orders] Resend delivery email error:", error);
  } catch (err) {
    console.error("[orders] Failed to send delivery date email:", err);
  }
}

// ── Manual-capture (Sourced for You authorization) emails ────────────────────

/**
 * Sent instead of sendOrderConfirmationEmail when an order is created with a
 * manual-capture (Sourced for You) authorization — payment is authorized but
 * NOT yet charged. Makes that explicit so the customer never thinks they've
 * been billed before the vendor confirms availability.
 */
export async function sendAvailabilityConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  authorizedAmountCents: number;
  items: EmailItem[];
  shippingAddress?: EmailShippingAddress;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[orders] Resend not configured — skipping availability confirmation email");
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const trackUrl = `${siteUrl}/orders/${params.orderNumber}`;
  const firstName = params.customerName.split(" ")[0];
  const amountFormatted = `$${(params.authorizedAmountCents / 100).toFixed(2)}`;
  const shippingBlock = renderShippingAddressBlock(params.shippingAddress, params.customerName);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Order Received</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for your order with BingBing Jade.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Because this is a one-of-a-kind <strong>Sourced for You</strong> piece, your payment method has been
              authorized while we confirm availability with our overseas sourcing partner. Your payment has not yet
              been finalized.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              We will notify you as soon as the piece has been secured and your order is confirmed.
            </p>

            <!-- Order number callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">Your Order Number</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#065f46;letter-spacing:0.04em;">${params.orderNumber}</p>
                </td>
              </tr>
            </table>

            <!-- Authorization notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#92400e;">Payment Status</p>
                  <p style="margin:0;font-size:16px;font-weight:700;color:#78350f;">Authorized — Not Yet Charged</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.6;">
                    ${amountFormatted} has been authorized on your payment method. Nothing has been charged.
                    Your payment will only be finalized once the piece has been secured with our sourcing partner.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Change-of-mind window -->
            <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.6;">
              If you change your mind, please contact us as soon as possible and
              <strong>before the order is confirmed</strong>. Once the piece has been secured and payment has been
              finalized, the order will be subject to the applicable
              <a href="${siteUrl}/policy" style="color:#059669;text-decoration:none;">Sourced for You cancellation and return policy</a>.
            </p>

            <!-- Order Summary -->
            ${buildItemRowsHtml(params.items)}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td style="padding:10px 0 0;font-size:14px;font-weight:600;color:#111827;">Total authorized</td>
                <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#065f46;text-align:right;">${amountFormatted}</td>
              </tr>
            </table>

            <div style="margin-top:24px;">
              ${shippingBlock}
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:4px 0 28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Track Your Order &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
              Questions? Reply to this email or reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a> or WhatsApp — we&rsquo;re always happy to give a personal update.
            </p>

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
              Warmly,<br>
              The BingBing Jade Team<br>
              <span style="color:#6b7280;">Natural, always.</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `We're Confirming Your BingBing Jade Piece — Order ${params.orderNumber}`,
      html,
    });
    if (error) console.error("[orders] Resend availability-confirmation email error:", error);
  } catch (err) {
    console.error("[orders] Failed to send availability confirmation email:", err);
  }
}

/**
 * Sent when an admin releases a manual-capture authorization because the
 * vendor confirmed the piece is unavailable. No refund is issued (and none is
 * needed) because payment was never captured — this email makes that explicit,
 * since customers otherwise reasonably expect refund language after a
 * cancellation.
 */
export async function sendAuthorizationReleasedEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items?: EmailItem[];
  shippingAddress?: EmailShippingAddress;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const firstName = params.customerName.split(" ")[0];
  const shippingBlock = params.shippingAddress
    ? renderShippingAddressBlock(params.shippingAddress, params.customerName, { includeVerifyNotice: false })
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#991b1b;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#fca5a5;">Order Update</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Unfortunately, our overseas sourcing partner has confirmed that this piece is no longer available.
              We're sorry for the disappointment — this happens rarely, but we wanted to let you know right away.
            </p>

            <!-- Order number callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#991b1b;">Cancelled</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#7f1d1d;letter-spacing:0.04em;">${params.orderNumber}</p>
                </td>
              </tr>
            </table>

            <!-- No payment finalized notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">No Payment Was Finalized</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#065f46;line-height:1.6;">
                    Your card was only ever authorized, never charged. That authorization has now been released.
                    Depending on your bank, the pending hold may take a few business days to fully disappear from
                    your statement — this is normal and not a charge.
                  </p>
                </td>
              </tr>
            </table>

            ${shippingBlock}

            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
              If you&rsquo;d still like a piece like this one, we&rsquo;d be glad to help source something similar for
              you directly.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#7c2d3e;border-radius:999px;">
                  <a href="${siteUrl}/custom-sourcing" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Help Me Find a Similar Piece &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
              Questions? Reply to this email or reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a> or WhatsApp — we&rsquo;re always happy to help.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `[Order Update] Piece Unavailable — Authorization Released for ${params.orderNumber}`,
      html,
    });
    if (error) console.error("[orders] Resend authorization-released email error:", error);
  } catch (err) {
    console.error("[orders] Failed to send authorization-released email:", err);
  }
}
