import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encodeCheckoutItems } from "@/lib/stripe-metadata";
import type { CartItem } from "@/types/cart";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  // In beta mode, checkout is admin-only
  if (process.env.NEXT_PUBLIC_CHECKOUT_MODE !== "live") {
    const adminPassword = req.headers.get("x-admin-password");
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Checkout is currently unavailable." }, { status: 403 });
    }
  }

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

  const MAX_CART_SIZE = 10;
  if (items.length > MAX_CART_SIZE) {
    return NextResponse.json(
      { error: `Cart cannot exceed ${MAX_CART_SIZE} items. Please contact us for large orders.` },
      { status: 400 }
    );
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
        return NextResponse.json({ error: `Your cart item "${product.name}" is outdated — please remove it and re-add it from the product page.` }, { status: 400 });
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

  // Add $20 shipping fee
  const SHIPPING_FEE = 20;
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: "Shipping" },
      unit_amount: SHIPPING_FEE * 100,
    },
    quantity: 1,
  });

  // Add 3.5% transaction fee (applied to items + shipping)
  const itemsTotal = validatedItems.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const transactionFeeAmount = Math.round((itemsTotal + SHIPPING_FEE) * 0.035 * 100); // cents
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: "Transaction Fee (3.5%)" },
      unit_amount: transactionFeeAmount,
    },
    quantity: 1,
  });

  const metadata = encodeCheckoutItems(
    validatedItems.map((i) => ({ productId: i.productId, optionId: i.optionId ?? null, price: i.price! }))
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    // Omitting payment_method_types lets Stripe enable all applicable methods automatically
    shipping_address_collection: {
      // Extend this list as needed — covers the most common customer countries for jade buyers
      allowed_countries: [
        "US", "CA", "GB", "AU", "NZ",
        "SG", "MY", "HK", "TW", "JP", "KR", "TH", "VN", "PH", "ID", "IN",
        "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI",
        "CN",
      ],
    },
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/checkout/cancel`,
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: {
        message: "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    metadata,
  });

  return NextResponse.json({ url: session.url });
}
