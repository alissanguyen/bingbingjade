import { NextRequest, NextResponse } from "next/server";
import { stripe, webhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Disable body parsing — we need the raw body for signature verification
export const dynamic = "force-dynamic";

/** Compact item shape stored in session metadata (keys kept short to stay under Stripe's 500-char limit). */
interface CompactItem {
  p: string;          // productId
  o?: string | null;  // optionId (omitted when null)
  $: number;          // price_usd
}

/** Normalised shape used throughout this handler. */
interface MetaItem {
  productId: string;
  optionId: string | null;
  price: number;
}

/** Collect items from all `items_N` metadata keys (new compact format).
 *  Falls back to the legacy `items` key if no `items_0` exists. */
function parseMetaItems(metadata: Stripe.Metadata | null): MetaItem[] {
  if (!metadata) return [];

  // New compact format: items_0, items_1, …
  if ("items_0" in metadata) {
    const result: MetaItem[] = [];
    let idx = 0;
    while (`items_${idx}` in metadata) {
      const chunk: CompactItem[] = JSON.parse(metadata[`items_${idx}`]);
      for (const c of chunk) {
        result.push({ productId: c.p, optionId: c.o ?? null, price: c.$ });
      }
      idx++;
    }
    return result;
  }

  // Legacy format: items key with full objects
  if ("items" in metadata) {
    const legacy = JSON.parse(metadata.items);
    return legacy.map((i: { productId: string; optionId?: string | null; price: number }) => ({
      productId: i.productId,
      optionId: i.optionId ?? null,
      price: i.price,
    }));
  }

  return [];
}

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
  let metaItems: MetaItem[] = [];
  try {
    metaItems = parseMetaItems(session.metadata);
  } catch {
    console.error("[webhook] Failed to parse metadata for session", session.id, session.metadata);
    return NextResponse.json({ error: "Invalid metadata." }, { status: 400 });
  }

  if (metaItems.length === 0) {
    console.error("[webhook] No items in metadata for session", session.id);
    return NextResponse.json({ error: "No items in metadata." }, { status: 400 });
  }

  // Fetch product/option names for order_items snapshot
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

  // Create order record — guard against duplicate-delivery race condition (PostgreSQL 23505)
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
    // 23505 = unique_violation: a concurrent webhook delivery already inserted this order
    if ((orderErr as { code?: string })?.code === "23505") {
      console.info("[webhook] Duplicate delivery ignored for session", session.id);
      return NextResponse.json({ received: true });
    }
    console.error("[webhook] Failed to create order for session", session.id, orderErr);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // Create order items
  await supabase.from("order_items").insert(
    metaItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_option_id: item.optionId ?? null,
      product_name: productNameMap.get(item.productId) ?? item.productId,
      option_label: item.optionId ? (optionLabelMap.get(item.optionId) ?? null) : null,
      price_usd: item.price,
    }))
  );

  // Mark options and products as sold — parallelise across items
  const affectedProductIds = new Set<string>(metaItems.map((i) => i.productId));

  await Promise.all(
    metaItems.map((item) =>
      item.optionId
        ? supabase.from("product_options").update({ status: "sold" }).eq("id", item.optionId)
        : supabase.from("product_options").update({ status: "sold" }).eq("product_id", item.productId)
    )
  );

  // Auto-mark product sold if all its options are now sold — parallelise across products
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
    "for session",
    session.id,
    "— items:",
    metaItems.length
  );

  // Trigger ISR revalidation
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, {
      method: "POST",
    }).catch(() => {});
  }

  return NextResponse.json({ received: true });
}
