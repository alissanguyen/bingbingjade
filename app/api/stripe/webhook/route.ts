import { NextRequest, NextResponse } from "next/server";
import { stripe, webhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decodeCheckoutItems } from "@/lib/stripe-metadata";
import {
  upsertCustomer,
  saveShippingAddress,
  generateOrderNumber,
  sendOrderConfirmationEmail,
} from "@/lib/orders";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Disable body parsing — we need the raw body for signature verification
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

  // ── Idempotency: check if this session was already processed ──────────────
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  // ── Parse items from metadata ─────────────────────────────────────────────
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

  // ── Fetch product/option names for order_items snapshot ───────────────────
  const productIds = [...new Set(metaItems.map((i) => i.productId))];
  const optionIds = metaItems.map((i) => i.optionId).filter(Boolean) as string[];

  const [productsResult, optionsResult] = await Promise.all([
    supabase.from("products").select("id, name").in("id", productIds),
    optionIds.length > 0
      ? supabase.from("product_options").select("id, label").in("id", optionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const productNameMap = new Map((productsResult.data ?? []).map((p) => [p.id, p.name as string]));
  const optionLabelMap = new Map((optionsResult.data ?? []).map((o) => [o.id, o.label as string | null]));

  // ── Customer & address (non-critical — failures do not block order creation) ─
  const customerEmail = session.customer_details?.email ?? null;
  const customerName = session.customer_details?.name ?? null;
  const customerPhone = session.customer_details?.phone ?? null;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

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

  let shippingAddressId: string | null = null;
  // In Stripe API 2026-02-25.clover, shipping address collected during Checkout
  // is available at session.collected_information.shipping_details.
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

  // ── Generate order number (non-critical — order is still created with NULL) ─
  let orderNumber: string | null = null;
  try {
    orderNumber = await generateOrderNumber();
  } catch (err) {
    console.error("[webhook] Order number generation failed (non-fatal):", err);
  }

  // ── Retrieve payment_intent_id if needed (session may expand it already) ──
  // session.payment_intent is string | Stripe.PaymentIntent | null
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  // ── Create order record ────────────────────────────────────────────────────
  // The UNIQUE constraint on stripe_session_id guards against duplicate-delivery
  // race conditions (23505 = unique_violation). This is the same as before.
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
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    // 23505 = unique_violation: a concurrent webhook delivery already inserted this order
    if ((orderErr as { code?: string })?.code === "23505") {
      console.info("[webhook] Duplicate delivery ignored for session", session.id);
      return NextResponse.json({ received: true });
    }
    console.error("[webhook] Failed to create order for session", session.id, orderErr);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // ── Create order items ────────────────────────────────────────────────────
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

  // ── Mark options and products as sold ─────────────────────────────────────
  const affectedProductIds = new Set<string>(metaItems.map((i) => i.productId));

  await Promise.all(
    metaItems.map((item) =>
      item.optionId
        ? supabase.from("product_options").update({ status: "sold" }).eq("id", item.optionId)
        : supabase.from("product_options").update({ status: "sold" }).eq("product_id", item.productId)
    )
  );

  // Auto-mark product sold if all its options are now sold
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
    metaItems.length
  );

  // ── Send branded confirmation email ───────────────────────────────────────
  if (orderNumber && customerName && customerEmail) {
    await sendOrderConfirmationEmail({
      orderNumber,
      customerName,
      customerEmail,
      amountTotalCents: session.amount_total ?? 0,
      items: metaItems.map((item) => ({
        name: productNameMap.get(item.productId) ?? item.productId,
        option: item.optionId ? (optionLabelMap.get(item.optionId) ?? null) : null,
        price: item.price,
        quantity: 1,
      })),
    });
  }

  // ── Trigger ISR revalidation ──────────────────────────────────────────────
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, {
      method: "POST",
    }).catch(() => {});
  }

  return NextResponse.json({ received: true });
}
