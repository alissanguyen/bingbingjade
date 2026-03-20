import { NextRequest, NextResponse } from "next/server";
import { stripe, webhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Disable body parsing — we need the raw body for signature verification
export const dynamic = "force-dynamic";

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

  // Idempotency: check if this session was already processed
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  // Parse items from metadata
  let metaItems: Array<{
    productId: string;
    optionId: string | null;
    productName: string;
    optionLabel: string | null;
    price: number;
  }> = [];

  try {
    metaItems = JSON.parse(session.metadata?.items ?? "[]");
  } catch {
    return NextResponse.json({ error: "Invalid metadata." }, { status: 400 });
  }

  // Create order record
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? "usd",
      status: "paid",
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("Failed to create order:", orderErr);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // Create order items
  if (metaItems.length > 0) {
    await supabase.from("order_items").insert(
      metaItems.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_option_id: item.optionId ?? null,
        product_name: item.productName,
        option_label: item.optionLabel ?? null,
        price_usd: item.price,
      }))
    );
  }

  // Mark options and products as sold
  const affectedProductIds = new Set<string>();

  for (const item of metaItems) {
    affectedProductIds.add(item.productId);

    if (item.optionId) {
      // Mark specific option sold
      await supabase
        .from("product_options")
        .update({ status: "sold" })
        .eq("id", item.optionId);
    } else {
      // No optionId = single no-label option; mark all options for this product sold
      await supabase
        .from("product_options")
        .update({ status: "sold" })
        .eq("product_id", item.productId);
    }
  }

  // Auto-mark product sold if all its options are now sold
  for (const productId of affectedProductIds) {
    const { data: allOptions } = await supabase
      .from("product_options")
      .select("status")
      .eq("product_id", productId);

    const hasOptions = (allOptions?.length ?? 0) > 0;
    const allSold = hasOptions && allOptions!.every((o) => o.status === "sold");

    if (!hasOptions || allSold) {
      await supabase
        .from("products")
        .update({ status: "sold" })
        .eq("id", productId);
    }
  }

  // Trigger ISR revalidation (POST)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, {
      method: "POST",
    }).catch(() => {});
  }

  return NextResponse.json({ received: true });
}
