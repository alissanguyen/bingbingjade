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
import { commitDiscount, normalizeEmail } from "@/lib/discount";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { MetaItem } from "@/lib/stripe-metadata";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing stripe-signature or webhook secret." }, { status: 400 });
  }

  const rawBody = await req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const supabase = supabaseAdmin;

  // ── Idempotency: check if this session was already processed ──────────────────
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
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
  const shippingDetails = session.collected_information?.shipping_details ?? null;

  if (customerId && shippingDetails?.address) {
    const addr = shippingDetails.address;
    if (addr.line1 && addr.city && addr.postal_code && addr.country) {
      try {
        shippingAddressId = await saveShippingAddress({
          customerId,
          recipientName: shippingDetails.name ?? null,
          line1: addr.line1,
          line2: addr.line2 ?? null,
          city: addr.city,
          state: addr.state ?? "",
          postal: addr.postal_code,
          country: addr.country,
        });
      } catch (err) {
        console.error("[webhook] Address save failed (non-fatal):", err);
      }
    }
  }

  // ── Generate order number ─────────────────────────────────────────────────────
  let orderNumber: string | null = null;
  try {
    orderNumber = await generateOrderNumber();
  } catch (err) {
    console.error("[webhook] Order number generation failed (non-fatal):", err);
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

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
      // Discount fields
      discount_source: discountMeta?.source ?? null,
      discount_amount_cents: discountMeta?.amountCents ?? 0,
      subtotal_before_discount_cents: discountMeta?.subtotalBeforeCents ?? null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    if ((orderErr as { code?: string })?.code === "23505") {
      console.info("[webhook] Duplicate delivery ignored for session", session.id);
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
      const committed = await commitDiscount({
        source: discountMeta.source as "welcome" | "referral" | "campaign" | "store_credit",
        customerEmail,
        customerId,
        orderId: order.id,
        discountAmountCents: discountMeta.amountCents,
        campaignId: discountMeta.campaignId,
        referrerCustomerId: discountMeta.referrerCustomerId,
        referralCode: discountMeta.code,
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

  // ── Create order items ────────────────────────────────────────────────────────
  await supabase.from("order_items").insert(
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
      };
    })
  );

  // ── Mark options and products as sold ─────────────────────────────────────────
  const affectedProductIds = new Set<string>(metaItems.map((i) => i.productId));

  await Promise.all(
    metaItems.map((item) =>
      item.optionId
        ? supabase.from("product_options").update({ status: "sold" }).eq("id", item.optionId)
        : supabase.from("product_options").update({ status: "sold" }).eq("product_id", item.productId)
    )
  );

  await Promise.all(
    [...affectedProductIds].map(async (productId) => {
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
