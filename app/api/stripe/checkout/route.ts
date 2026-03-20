import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CartItem } from "@/types/cart";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  let body: { items: CartItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  const supabase = supabaseAdmin;

  // Validate each item server-side
  const lineItems: { price_data: { currency: string; product_data: { name: string; images?: string[] }; unit_amount: number }; quantity: number }[] = [];
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    if (!item.productId) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }

    // Fetch fresh product + option data from DB
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, status, price_display_usd, sale_price_usd, public_id, slug")
      .eq("id", item.productId)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ error: `Product not found: ${item.productName}` }, { status: 400 });
    }

    if (product.status === "sold") {
      return NextResponse.json({ error: `"${product.name}" has already been sold.` }, { status: 409 });
    }

    let serverPrice: number | null = null;
    let displayLabel = product.name;

    if (item.optionId) {
      const { data: option, error: oErr } = await supabase
        .from("product_options")
        .select("id, label, price_usd, status")
        .eq("id", item.optionId)
        .eq("product_id", item.productId)
        .single();

      if (oErr || !option) {
        return NextResponse.json({ error: `Option not found for "${product.name}".` }, { status: 400 });
      }

      if (option.status === "sold") {
        return NextResponse.json({ error: `The selected option for "${product.name}" is sold out.` }, { status: 409 });
      }

      if (option.label) displayLabel = `${product.name} — ${option.label}`;
      serverPrice = option.price_usd ?? product.price_display_usd;
    } else {
      serverPrice = product.sale_price_usd ?? product.price_display_usd;
    }

    // Apply sale price at product level
    if (product.status === "on_sale" && product.sale_price_usd != null) {
      serverPrice = product.sale_price_usd;
    }

    if (serverPrice == null || serverPrice <= 0) {
      return NextResponse.json(
        { error: `"${product.name}" has no price set. Please contact us directly.` },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(serverPrice * 100); // cents

    const images: string[] = [];
    if (item.thumbnail) images.push(item.thumbnail);

    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: displayLabel, ...(images.length > 0 ? { images } : {}) },
        unit_amount: unitAmount,
      },
      quantity: 1,
    });

    validatedItems.push({ ...item, price: serverPrice });
  }

  // Build metadata for webhook
  const metaItems = validatedItems.map((i) => ({
    productId: i.productId,
    optionId: i.optionId,
    productName: i.productName,
    optionLabel: i.optionLabel,
    price: i.price,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    // Omitting payment_method_types lets Stripe enable all applicable methods automatically
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/checkout/cancel`,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    metadata: {
      items: JSON.stringify(metaItems),
    },
  });

  return NextResponse.json({ url: session.url });
}
