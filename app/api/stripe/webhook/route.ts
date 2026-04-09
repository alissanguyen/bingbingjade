import { NextRequest, NextResponse } from "next/server";
import { stripe, webhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decodeCheckoutItems, decodeDiscountMeta } from "@/lib/stripe-metadata";
import {
  upsertCustomer,
  saveShippingAddress,
  generateOrderNumber,
  sendOrderConfirmationEmail,
  fetchEmailItems,
} from "@/lib/orders";
import { commitDiscount, normalizeEmail, buildShippingFingerprint } from "@/lib/discount";
import { CREDIT_VALIDITY_DAYS } from "@/lib/sourcing-classification";
import { sendDepositConfirmationEmail } from "@/lib/sourcing-emails";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { MetaItem } from "@/lib/stripe-metadata";

// ── Shared helper: mark product options + parent products as sold ─────────────
async function markItemsAsSold(
  supabase: typeof supabaseAdmin,
  metaItems: MetaItem[]
): Promise<void> {
  // Mark affected options sold first
  await Promise.all(
    metaItems.map((item) =>
      item.optionId
        ? supabase.from("product_options").update({ status: "sold" }).eq("id", item.optionId)
        : supabase.from("product_options").update({ status: "sold" }).eq("product_id", item.productId)
    )
  );

  // Mark parent product sold when all options are sold (or it has no options)
  const affectedProductIds = [...new Set(metaItems.map((i) => i.productId))];
  await Promise.all(
    affectedProductIds.map(async (productId) => {
      const { data: allOptions } = await supabase
        .from("product_options")
        .select("status")
        .eq("product_id", productId);

      const hasOptions = (allOptions?.length ?? 0) > 0;
      const allSold = hasOptions && allOptions!.every((o) => o.status === "sold");

      if (!hasOptions || allSold) {
        await supabase.from("products").update({ status: "sold" }).eq("id", productId);
      }
    })
  );
}

const isLive = process.env.NEXT_PUBLIC_CHECKOUT_MODE === "live";

export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  let event: Stripe.Event;

  if (isLive) {
    // Production: require valid Stripe signature
    const sig = req.headers.get("stripe-signature");
    if (!sig || !webhookSecret) {
      return NextResponse.json({ error: "Missing stripe-signature or webhook secret." }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Webhook signature verification failed.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    // Test mode: accept either a full Stripe event object OR just { session_id: "cs_test_..." }
    // which we'll expand into a synthetic event by fetching the session from Stripe.
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyBuffer.toString());
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "session_id" in parsed &&
      typeof (parsed as Record<string, unknown>).session_id === "string"
    ) {
      const sessionId = (parsed as Record<string, string>).session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      event = {
        id: `evt_test_local_${Date.now()}`,
        object: "event",
        type: "checkout.session.completed",
        data: { object: session },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
        api_version: "2026-02-25.clover",
      } as unknown as Stripe.Event;
    } else {
      event = parsed as Stripe.Event;
    }
  }

  const supabase = supabaseAdmin;

  // ── checkout.session.expired ──────────────────────────────────────────────────
  if (event.type === "checkout.session.expired") {
    const expired = event.data.object as Stripe.Checkout.Session;
    const now = new Date().toISOString();

    if (expired.metadata?.is_sourcing_offer_checkout === "true") {
      // New structured offer checkout expired
      const offerId = expired.metadata.sourcing_checkout_offer_id;
      if (offerId) {
        const { data: offer } = await supabase
          .from("sourcing_checkout_offers")
          .select("id, sourcing_request_id, sourcing_attempt_option_id")
          .eq("id", offerId)
          .eq("status", "pending_checkout")
          .maybeSingle();
        if (offer) {
          await supabase.from("sourcing_checkout_offers")
            .update({ status: "expired", updated_at: now }).eq("id", offerId);
          await supabase.from("sourcing_attempt_options")
            .update({ status: "active", updated_at: now })
            .eq("id", offer.sourcing_attempt_option_id)
            .eq("status", "converted_to_checkout");
          await supabase.from("sourcing_requests")
            .update({ sourcing_status: "awaiting_response", updated_at: now })
            .eq("id", offer.sourcing_request_id)
            .eq("sourcing_status", "accepted_pending_checkout");
        }
      }
    } else if (expired.metadata?.is_sourcing_private_checkout === "true") {
      // Legacy private checkout
      const srcId = expired.metadata.sourcing_request_id;
      if (srcId) {
        await supabase
          .from("sourcing_requests")
          .update({ sourcing_status: "checkout_expired", updated_at: now })
          .eq("id", srcId)
          .eq("private_checkout_session_id", expired.id);
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // ── Route: sourcing deposit vs offer checkout vs legacy private checkout vs product order ──
  if (session.metadata?.is_sourcing_deposit === "true") {
    return handleSourcingDeposit(session, supabase);
  }

  if (session.metadata?.is_sourcing_offer_checkout === "true") {
    return handleSourcingOfferCheckout(session, supabase);
  }

  if (session.metadata?.is_sourcing_private_checkout === "true") {
    return handleSourcingPrivateCheckout(session, supabase);
  }

  // ── Resolve payment intent ID early (needed for idempotency + insert) ──────────
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  // ── Idempotency: check by session_id OR payment_intent_id ────────────────────
  // The orders table has unique constraints on both columns. Checking only one
  // would miss cases where the production webhook already processed the same PI.
  const idempotencyFilter = paymentIntentId
    ? `stripe_session_id.eq.${session.id},stripe_payment_intent_id.eq.${paymentIntentId}`
    : `stripe_session_id.eq.${session.id}`;

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .or(idempotencyFilter)
    .maybeSingle();

  if (existing) {
    console.info("[webhook] Already processed (order exists), skipping session", session.id);
    return NextResponse.json({ received: true });
  }

  // ── Parse items from metadata ─────────────────────────────────────────────────
  let metaItems: MetaItem[] = [];
  try {
    metaItems = decodeCheckoutItems(session.metadata);
  } catch {
    console.error("[webhook] Failed to parse metadata for session", session.id, session.metadata);
    return NextResponse.json({ error: "Invalid metadata." }, { status: 400 });
  }

  if (metaItems.length === 0) {
    console.error("[webhook] No items in metadata for session", session.id);
    return NextResponse.json({ error: "No items in metadata." }, { status: 400 });
  }

  // ── Parse discount metadata ───────────────────────────────────────────────────
  const discountMeta = decodeDiscountMeta(session.metadata);

  // ── Fetch product/option names for order_items snapshot ──────────────────────
  const productIds = [...new Set(metaItems.map((i) => i.productId))];
  const optionIds = metaItems.map((i) => i.optionId).filter(Boolean) as string[];

  const [productsResult, optionsResult] = await Promise.all([
    supabase.from("products").select("id, name").in("id", productIds),
    optionIds.length > 0
      ? supabase.from("product_options").select("id, label").in("id", optionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const productNameMap = new Map(
    (productsResult.data ?? []).map((p) => [p.id, p.name as string])
  );
  const optionLabelMap = new Map(
    (optionsResult.data ?? []).map((o) => [o.id, o.label as string | null])
  );

  // ── Customer & address ────────────────────────────────────────────────────────
  // Prefer the email we stored in metadata (normalized, from our cart UI),
  // falling back to whatever Stripe collected.
  const metadataEmail = session.metadata?.cust_email ?? null;
  const stripeEmail = session.customer_details?.email ?? null;
  const customerEmail = metadataEmail ?? (stripeEmail ? normalizeEmail(stripeEmail) : null);
  const customerName = session.customer_details?.name ?? null;
  const customerPhone = session.customer_details?.phone ?? null;
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : null;

  let customerId: string | null = null;
  if (customerEmail && customerName) {
    try {
      customerId = await upsertCustomer({
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        stripeCustomerId,
      });
    } catch (err) {
      console.error("[webhook] Customer upsert failed (non-fatal):", err);
    }
  }

  // Update customer marketing opt-in if email is in subscribers list
  if (customerId && customerEmail) {
    try {
      const { data: subscriber } = await supabase
        .from("email_subscribers")
        .select("id")
        .eq("email", customerEmail)
        .maybeSingle();

      if (subscriber) {
        await supabase
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
      console.error("[webhook] Marketing opt-in sync failed (non-fatal):", err);
    }
  }

  // Update paid order tracking on the customer record
  if (customerId && customerEmail) {
    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("paid_order_count, first_paid_order_at")
        .eq("id", customerId)
        .single();

      if (customer) {
        const newCount = (customer.paid_order_count ?? 0) + 1;
        await supabase
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
      console.error("[webhook] Customer paid_order_count update failed (non-fatal):", err);
    }
  }

  let shippingAddressId: string | null = null;

  // Prefer address from our metadata (collected pre-Stripe); fall back to Stripe-collected shipping.
  const metaAddr = session.metadata?.ship_line1 ? {
    name: session.metadata.ship_name ?? null,
    line1: session.metadata.ship_line1,
    line2: session.metadata.ship_line2 ?? null,
    city: session.metadata.ship_city ?? null,
    state: session.metadata.ship_state ?? null,
    postal: session.metadata.ship_postal ?? null,
    country: session.metadata.ship_country ?? null,
  } : null;

  const stripeShipping = session.collected_information?.shipping_details ?? null;
  const resolvedAddr = metaAddr ?? (stripeShipping?.address ? {
    name: stripeShipping.name ?? null,
    line1: stripeShipping.address.line1 ?? null,
    line2: stripeShipping.address.line2 ?? null,
    city: stripeShipping.address.city ?? null,
    state: stripeShipping.address.state ?? null,
    postal: stripeShipping.address.postal_code ?? null,
    country: stripeShipping.address.country ?? null,
  } : null);

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
      console.error("[webhook] Address save failed (non-fatal):", err);
    }
  }

  // ── Generate order number ─────────────────────────────────────────────────────
  let orderNumber: string | null = null;
  try {
    orderNumber = await generateOrderNumber();
  } catch (err) {
    console.error("[webhook] Order number generation failed (non-fatal):", err);
  }

  // ── Fetch Stripe line items to extract shipping + fee breakdown ──────────────
  let feeBreakdown: Record<string, number | string> | null = null;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    let shippingCents = 0;
    let txFeeCents = 0;
    let discountCents = discountMeta?.amountCents ?? 0;
    for (const li of lineItems.data) {
      const name = li.description ?? "";
      if (name.startsWith("Shipping") || name.startsWith("Priority Sourcing")) {
        shippingCents = li.amount_total;
      } else if (name.startsWith("Transaction Fee")) {
        txFeeCents = li.amount_total;
      }
    }
    const fees: Record<string, number | string> = {};
    if (shippingCents > 0) fees.shipping = shippingCents / 100;
    if (txFeeCents > 0) fees.paypal = txFeeCents / 100; // stored under 'paypal' = transaction fee slot
    if (discountCents > 0) fees.discount = discountCents / 100;
    if (Object.keys(fees).length > 0) feeBreakdown = fees;
  } catch (err) {
    console.error("[webhook] Failed to fetch line items for fee breakdown (non-fatal):", err);
  }

  // ── Create order record ───────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
      order_number: orderNumber,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone_snapshot: customerPhone,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? "usd",
      status: "paid",
      order_status: "order_confirmed",
      source: "stripe",
      shipping_address_id: shippingAddressId,
      fee_breakdown: feeBreakdown,
      // Discount fields
      discount_source: discountMeta?.source ?? null,
      discount_amount_cents: discountMeta?.amountCents ?? 0,
      subtotal_before_discount_cents: discountMeta?.subtotalBeforeCents ?? null,
      // Sourcing credit fields (populated below if credit was applied)
      sourcing_credit_applied: session.metadata?.sourcing_credit_applied_cents
        ? parseInt(session.metadata.sourcing_credit_applied_cents, 10)
        : 0,
      sourcing_request_id: session.metadata?.sourcing_request_id ?? null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    if ((orderErr as { code?: string })?.code === "23505") {
      const { message, details } = orderErr as { message?: string; details?: string };
      console.info(
        "[webhook] Duplicate insert for session", session.id,
        "| constraint:", message,
        "| details:", details
      );
      // Still mark products as sold — order already exists from a prior run
      await markItemsAsSold(supabase, metaItems);
      return NextResponse.json({ received: true });
    }
    console.error("[webhook] Failed to create order for session", session.id, orderErr);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // ── Commit discount ───────────────────────────────────────────────────────────
  let couponRedemptionId: string | undefined;
  let referralId: string | undefined;

  if (discountMeta && customerEmail) {
    try {
      // Build shipping fingerprint for abuse detection on welcome coupons
      const shippingFingerprint =
        discountMeta.source === "welcome"
          ? buildShippingFingerprint(customerPhone, resolvedAddr?.city, resolvedAddr?.postal, resolvedAddr?.country)
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

      couponRedemptionId = committed.couponRedemptionId;
      referralId = committed.referralId;

      // Link discount records back to the order
      if (couponRedemptionId || referralId) {
        await supabase
          .from("orders")
          .update({
            coupon_redemption_id: couponRedemptionId ?? null,
            referral_id: referralId ?? null,
          })
          .eq("id", order.id);
      }
    } catch (err) {
      console.error("[webhook] Discount commit failed (non-fatal):", err);
    }
  }

  // ── Commit sourcing credit (idempotent via checkout_session_id) ──────────────
  if (session.metadata?.sourcing_request_id && session.metadata?.sourcing_credit_applied_cents) {
    const sourcingRequestId = session.metadata.sourcing_request_id;
    const appliedCents = parseInt(session.metadata.sourcing_credit_applied_cents, 10);

    try {
      // Idempotency: only insert if no row exists for this checkout session
      const { data: existingLedger } = await supabase
        .from("sourcing_credit_ledger")
        .select("id")
        .eq("checkout_session_id", session.id)
        .eq("event_type", "credit_consumed")
        .maybeSingle();

      if (!existingLedger) {
        const { data: sourcingReq } = await supabase
          .from("sourcing_requests")
          .select("customer_email, user_id")
          .eq("id", sourcingRequestId)
          .maybeSingle();

        if (sourcingReq) {
          await supabase.from("sourcing_credit_ledger").insert({
            sourcing_request_id: sourcingRequestId,
            customer_email:      sourcingReq.customer_email,
            user_id:             sourcingReq.user_id ?? null,
            event_type:          "credit_consumed",
            amount_cents:        appliedCents,
            currency:            "usd",
            order_id:            order.id,
            checkout_session_id: session.id,
            notes:               `Applied at checkout for order ${orderNumber ?? order.id}`,
          });

          // Clear the lock so any remaining credit can be used on a future order
          await supabase
            .from("sourcing_requests")
            .update({ credit_claimed_at: null, credit_claimed_session_id: null, updated_at: new Date().toISOString() })
            .eq("id", sourcingRequestId);
        }
      }
    } catch (err) {
      console.error("[webhook] Sourcing credit commit failed (non-fatal):", err);
    }
  }

  // ── Create order items ────────────────────────────────────────────────────────
  const { data: insertedItems } = await supabase.from("order_items").insert(
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
  ).select("id, inventory_type");

  // ── Create shipments grouped by inventory_type ────────────────────────────────
  if (insertedItems && insertedItems.length > 0) {
    const groups = new Map<string, string[]>();
    for (const row of insertedItems) {
      const t = (row.inventory_type as string) ?? "sourced_for_you";
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(row.id as string);
    }

    let shipmentIndex = 1;
    for (const [inventoryType, itemIds] of groups) {
      const { data: shipment } = await supabase
        .from("shipments")
        .insert({
          order_id: order.id,
          shipment_number: orderNumber ? `${orderNumber}-S${shipmentIndex}` : null,
          fulfillment_type: inventoryType,
          status: "confirmed",
        })
        .select("id")
        .single();

      if (shipment) {
        await supabase.from("shipment_items").insert(
          itemIds.map((oid) => ({ shipment_id: shipment.id, order_item_id: oid }))
        );

        const EVENTS_AVAILABLE_NOW = [
          { event_key: "confirmed",  label: "Order Confirmed", description: "Order placed and payment received.",        sort_order: 0, is_current: true,  is_completed: false },
          { event_key: "packing",    label: "Packing",         description: "Your piece is being carefully packaged.",   sort_order: 1, is_current: false, is_completed: false },
          { event_key: "shipped",    label: "Shipped",          description: "Your order is on its way to you.",          sort_order: 2, is_current: false, is_completed: false },
          { event_key: "delivered",  label: "Delivered",        description: "Your piece has arrived.",                  sort_order: 3, is_current: false, is_completed: false },
        ];
        const EVENTS_SOURCED = [
          { event_key: "confirmed",          label: "Order Confirmed",        description: "Order placed and payment received.",                             sort_order: 0, is_current: true,  is_completed: false },
          { event_key: "quality_inspection", label: "Quality Inspection",     description: "Your piece is being carefully inspected to meet our standards.", sort_order: 1, is_current: false, is_completed: false },
          { event_key: "certification",      label: "Certification",          description: "Your jade is undergoing authentication and certification.",      sort_order: 2, is_current: false, is_completed: false },
          { event_key: "arriving_at_studio", label: "Arriving at Our Studio", description: "Your piece is on its way to our studio for final handling.",    sort_order: 3, is_current: false, is_completed: false },
          { event_key: "shipped",            label: "Shipped",                description: "Your order has been carefully packaged and shipped.",            sort_order: 4, is_current: false, is_completed: false },
          { event_key: "delivered",          label: "Delivered",              description: "Your piece has arrived. We hope it brings you lasting beauty.",  sort_order: 5, is_current: false, is_completed: false },
        ];

        await supabase.from("shipment_events").insert(
          (inventoryType === "available_now" ? EVENTS_AVAILABLE_NOW : EVENTS_SOURCED)
            .map((e) => ({ ...e, shipment_id: shipment.id }))
        );
      }
      shipmentIndex++;
    }
  }

  // ── Mark options and products as sold ─────────────────────────────────────────
  await markItemsAsSold(supabase, metaItems);

  console.info(
    "[webhook] Order created",
    order.id,
    orderNumber ? `(${orderNumber})` : "(no order number)",
    "for session",
    session.id,
    "— items:",
    metaItems.length,
    discountMeta ? `— discount: ${discountMeta.source} $${(discountMeta.amountCents / 100).toFixed(2)}` : ""
  );

  // ── Send branded confirmation email ───────────────────────────────────────────
  if (orderNumber && customerName && customerEmail) {
    const emailItems = await fetchEmailItems(order.id);
    await sendOrderConfirmationEmail({
      orderNumber,
      customerName,
      customerEmail,
      amountTotalCents: session.amount_total ?? 0,
      items: emailItems,
    });
  }

  // ── Trigger ISR revalidation ──────────────────────────────────────────────────
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, { method: "POST" }).catch(() => {});
  }

  return NextResponse.json({ received: true });
}

// ── Sourcing offer checkout handler (new structured flow) ────────────────────
async function handleSourcingOfferCheckout(
  session: Stripe.Checkout.Session,
  supabase: typeof supabaseAdmin
): Promise<NextResponse> {
  const offerId = session.metadata?.sourcing_checkout_offer_id;
  if (!offerId) {
    console.error("[webhook/offer] Missing sourcing_checkout_offer_id", session.id);
    return NextResponse.json({ error: "Missing offer ID." }, { status: 400 });
  }

  // Idempotency: check if offer already paid
  const { data: offer } = await supabase
    .from("sourcing_checkout_offers")
    .select("id, status, sourcing_request_id, sourcing_attempt_id, sourcing_attempt_option_id, sourcing_credit_applied_cents, customer_email, title_snapshot")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer) {
    console.error("[webhook/offer] Offer not found:", offerId);
    return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  }
  if (offer.status === "paid") {
    return NextResponse.json({ received: true }); // idempotent
  }

  const now = new Date().toISOString();
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id?: string } | null)?.id ?? null;

  // Mark offer paid
  await supabase.from("sourcing_checkout_offers").update({
    status: "paid",
    stripe_payment_intent_id: paymentIntentId,
    paid_at: now,
    updated_at: now,
  }).eq("id", offerId);

  // Mark option paid
  await supabase.from("sourcing_attempt_options").update({
    status: "paid", updated_at: now,
  }).eq("id", offer.sourcing_attempt_option_id);

  // Mark attempt accepted
  await supabase.from("sourcing_attempts").update({
    status: "accepted", updated_at: now,
  }).eq("id", offer.sourcing_attempt_id);

  // Mark request fulfilled
  await supabase.from("sourcing_requests").update({
    sourcing_status: "fulfilled", updated_at: now,
  }).eq("id", offer.sourcing_request_id);

  // Consume credit (idempotent via unique on checkout_session_id + event_type)
  const appliedCents = offer.sourcing_credit_applied_cents ?? 0;
  if (appliedCents > 0) {
    const { data: existingLedger } = await supabase
      .from("sourcing_credit_ledger")
      .select("id")
      .eq("checkout_session_id", session.id)
      .eq("event_type", "credit_consumed")
      .maybeSingle();

    if (!existingLedger) {
      const { data: srcReq } = await supabase
        .from("sourcing_requests")
        .select("customer_email, user_id")
        .eq("id", offer.sourcing_request_id)
        .maybeSingle();

      if (srcReq) {
        await supabase.from("sourcing_credit_ledger").insert({
          sourcing_request_id:        offer.sourcing_request_id,
          customer_email:             srcReq.customer_email,
          user_id:                    srcReq.user_id ?? null,
          event_type:                 "credit_consumed",
          amount_cents:               appliedCents,
          currency:                   "usd",
          checkout_session_id:        session.id,
          sourcing_checkout_offer_id: offerId,
          notes:                      `Applied via offer checkout ${offerId}`,
        });
      }
    }
  }

  console.info("[webhook/offer] Fulfilled offer", offerId, "— credit applied:", appliedCents);
  return NextResponse.json({ received: true });
}

// ── Sourcing private checkout handler ─────────────────────────────────────────
// Called when a customer pays via the admin-generated private checkout link.
async function handleSourcingPrivateCheckout(
  session: Stripe.Checkout.Session,
  supabase: typeof supabaseAdmin
): Promise<NextResponse> {
  const sourcingRequestId = session.metadata?.sourcing_request_id;
  const appliedCentsStr   = session.metadata?.sourcing_credit_applied_cents;

  if (!sourcingRequestId) {
    console.error("[webhook/sourcing-private] Missing sourcing_request_id", session.id);
    return NextResponse.json({ error: "Missing sourcing_request_id." }, { status: 400 });
  }

  // Idempotency: check existing ledger row for this session
  const { data: existingLedger } = await supabase
    .from("sourcing_credit_ledger")
    .select("id")
    .eq("checkout_session_id", session.id)
    .eq("event_type", "credit_consumed")
    .maybeSingle();

  if (existingLedger) {
    return NextResponse.json({ received: true });
  }

  const { data: sourcingReq } = await supabase
    .from("sourcing_requests")
    .select("id, customer_email, user_id, payment_status")
    .eq("id", sourcingRequestId)
    .maybeSingle();

  if (!sourcingReq || sourcingReq.payment_status !== "paid") {
    console.error("[webhook/sourcing-private] Sourcing request not found or not paid:", sourcingRequestId);
    return NextResponse.json({ error: "Sourcing request invalid." }, { status: 400 });
  }

  const appliedCents = appliedCentsStr ? parseInt(appliedCentsStr, 10) : 0;
  const now = new Date().toISOString();

  if (appliedCents > 0) {
    await supabase.from("sourcing_credit_ledger").insert({
      sourcing_request_id:  sourcingRequestId,
      customer_email:       sourcingReq.customer_email,
      user_id:              sourcingReq.user_id ?? null,
      event_type:           "credit_consumed",
      amount_cents:         appliedCents,
      currency:             "usd",
      checkout_session_id:  session.id,
      notes:                `Applied via private checkout ${session.id}`,
    });
  }

  // Mark the request fulfilled
  await supabase
    .from("sourcing_requests")
    .update({
      sourcing_status: "fulfilled",
      updated_at:      now,
    })
    .eq("id", sourcingRequestId);

  console.info("[webhook/sourcing-private] Fulfilled request", sourcingRequestId, "— credit applied:", appliedCents);
  return NextResponse.json({ received: true });
}

// ── Sourcing deposit handler ───────────────────────────────────────────────────
async function handleSourcingDeposit(
  session: Stripe.Checkout.Session,
  supabase: typeof supabaseAdmin
): Promise<NextResponse> {
  const sourcingRequestId = session.metadata?.sourcing_request_id;
  if (!sourcingRequestId) {
    console.error("[webhook/sourcing] Missing sourcing_request_id in metadata", session.id);
    return NextResponse.json({ error: "Missing sourcing_request_id." }, { status: 400 });
  }

  // Idempotency: check if already processed
  const { data: existing } = await supabase
    .from("sourcing_requests")
    .select("id, payment_status, deposit_amount_cents, customer_email, user_id")
    .eq("id", sourcingRequestId)
    .maybeSingle();

  if (!existing) {
    console.error("[webhook/sourcing] sourcing_request not found:", sourcingRequestId);
    return NextResponse.json({ error: "Sourcing request not found." }, { status: 404 });
  }

  if (existing.payment_status === "paid") {
    // Already processed — idempotent no-op
    return NextResponse.json({ received: true });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id?: string } | null)?.id ?? null;

  const now = new Date().toISOString();
  const creditExpiresAt = new Date(
    Date.now() + CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Mark as paid
  await supabase
    .from("sourcing_requests")
    .update({
      payment_status:          "paid",
      stripe_payment_intent_id: paymentIntentId,
      paid_at:                 now,
      credit_expires_at:       creditExpiresAt,
      updated_at:              now,
    })
    .eq("id", sourcingRequestId);

  // Create credit_created ledger entry (idempotent: unique on sourcing_request_id + event_type + checkout_session_id)
  const { data: existingLedger } = await supabase
    .from("sourcing_credit_ledger")
    .select("id")
    .eq("sourcing_request_id", sourcingRequestId)
    .eq("event_type", "credit_created")
    .maybeSingle();

  if (!existingLedger) {
    await supabase.from("sourcing_credit_ledger").insert({
      sourcing_request_id:  sourcingRequestId,
      customer_email:       existing.customer_email,
      user_id:              existing.user_id ?? null,
      event_type:           "credit_created",
      amount_cents:         existing.deposit_amount_cents,
      currency:             "usd",
      checkout_session_id:  session.id,
      notes:                `Deposit paid via Stripe session ${session.id}`,
    });
  }

  // Fetch public_token to include in confirmation email
  const { data: updated } = await supabase
    .from("sourcing_requests")
    .select("public_token, customer_name, category, request_type, deposit_amount_cents")
    .eq("id", sourcingRequestId)
    .maybeSingle();

  if (updated?.public_token) {
    sendDepositConfirmationEmail({
      customerName:  updated.customer_name,
      customerEmail: existing.customer_email,
      publicToken:   updated.public_token,
      category:      updated.category,
      requestType:   updated.request_type,
      depositCents:  updated.deposit_amount_cents,
    }).catch(() => {});
  }

  console.info("[webhook/sourcing] Deposit confirmed for", sourcingRequestId, "— credit:", existing.deposit_amount_cents);
  return NextResponse.json({ received: true });
}
