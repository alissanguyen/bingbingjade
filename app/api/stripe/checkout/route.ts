import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encodeCheckoutItems, encodeDiscountMeta } from "@/lib/stripe-metadata";
import { validateDiscount, normalizeEmail } from "@/lib/discount";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";
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

  let body: {
    items: CartItem[];
    expedited?: boolean;
    shippingInsurance?: boolean;
    customerEmail?: string;
    discountCode?: string;
    sourcingRequestId?: string;
  };
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

  // ── Validate each item server-side ───────────────────────────────────────────
  const lineItems: {
    price_data: {
      currency: string;
      product_data: { name: string; images?: string[] };
      unit_amount: number;
    };
    quantity: number;
  }[] = [];
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    if (!item.productId) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, status, price_display_usd, sale_price_usd, public_id, slug, quick_ship")
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
        return NextResponse.json({
          error: `Your cart item "${product.name}" is outdated — please remove it and re-add it from the product page.`,
        }, { status: 400 });
      }

      if (option.status === "sold") {
        return NextResponse.json({
          error: `The selected option for "${product.name}" is sold out.`,
        }, { status: 409 });
      }

      if (option.label) displayLabel = `${product.name} — ${option.label}`;
      serverPrice = option.price_usd ?? product.price_display_usd;
    } else {
      serverPrice = product.sale_price_usd ?? product.price_display_usd;
    }

    if (product.status === "on_sale" && product.sale_price_usd != null) {
      serverPrice = product.sale_price_usd;
    }

    if (serverPrice == null || serverPrice <= 0) {
      return NextResponse.json(
        { error: `"${product.name}" has no price set. Please contact us directly.` },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(serverPrice * 100);
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

    const fulfillmentType = item.fulfillmentType ?? (product.quick_ship ? "available_now" : "sourced_for_you");
    validatedItems.push({ ...item, price: serverPrice, fulfillmentType });
  }

  // ── Server-side discount validation ──────────────────────────────────────────
  const itemsSubtotalCents = Math.round(
    validatedItems.reduce((sum, i) => sum + (i.price ?? 0), 0) * 100
  );

  let discountAmountCents = 0;
  let discountMetadata: Record<string, string> = {};

  if (body.customerEmail || body.discountCode) {
    const email = body.customerEmail ? normalizeEmail(body.customerEmail) : null;
    const discountResult = await validateDiscount({
      customerEmail: email,
      discountCode: body.discountCode ?? null,
      subtotalCents: itemsSubtotalCents,
    });

    if (discountResult.valid) {
      discountAmountCents = discountResult.discountAmountCents;
      discountMetadata = encodeDiscountMeta({
        source: discountResult.source,
        amountCents: discountResult.discountAmountCents,
        subtotalBeforeCents: itemsSubtotalCents,
        ...(discountResult.referralCode ? { code: discountResult.referralCode } : {}),
        ...(discountResult.subscriberCouponCode ? { code: discountResult.subscriberCouponCode } : {}),
        ...(body.discountCode && discountResult.source === "campaign"
          ? { code: body.discountCode.trim().toUpperCase() }
          : {}),
        ...(discountResult.referrerCustomerId
          ? { referrerCustomerId: discountResult.referrerCustomerId }
          : {}),
        ...(discountResult.campaignId ? { campaignId: discountResult.campaignId } : {}),
      });
    }
    // Discount validation failure is non-fatal — checkout proceeds without it
  }

  // ── Build shipping + fee line items ──────────────────────────────────────────
  const hasSourcingItems = validatedItems.some((i) => (i.fulfillmentType ?? "sourced_for_you") === "sourced_for_you");
  const isPrioritySourcing = body.expedited && hasSourcingItems;
  const shippingBase = isPrioritySourcing ? 100 : 20;
  const shippingFee = shippingBase + (validatedItems.length - 1) * 10;
  const shippingType = isPrioritySourcing ? "Priority Sourcing" : "Shipping";
  const shippingLabel =
    validatedItems.length > 1
      ? `${shippingType} (${validatedItems.length} pieces)`
      : shippingType;

  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: shippingLabel },
      unit_amount: shippingFee * 100,
    },
    quantity: 1,
  });

  // Shipping insurance: 5% of item subtotal (before discount — covers declared value)
  const insuranceFeeCents = body.shippingInsurance
    ? Math.round(itemsSubtotalCents * 0.05)
    : 0;
  if (insuranceFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping Insurance (5%)" },
        unit_amount: insuranceFeeCents,
      },
      quantity: 1,
    });
  }

  // Transaction fee applied to (items - coupon discount + insurance + shipping)
  const discountedItemsCents = Math.max(0, itemsSubtotalCents - discountAmountCents);
  const transactionFeeAmount = Math.round(
    (discountedItemsCents / 100 + insuranceFeeCents / 100 + shippingFee) * 0.035 * 100
  );
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: "Transaction Fee (3.5%)" },
      unit_amount: transactionFeeAmount,
    },
    quantity: 1,
  });

  // ── Apply sourcing credit (Option B) ─────────────────────────────────────────
  // Credit is applied as a direct reduction — Stripe receives the adjusted amount.
  let sourcingCreditApplied = 0;
  let sourcingRequestId: string | null = body.sourcingRequestId?.trim() || null;

  if (sourcingRequestId) {
    const { data: sourcingReq } = await supabaseAdmin
      .from("sourcing_requests")
      .select("id, customer_email, deposit_amount_cents, payment_status, credit_expires_at, credit_claimed_at, credit_claimed_session_id")
      .eq("id", sourcingRequestId)
      .maybeSingle();

    if (!sourcingReq || sourcingReq.payment_status !== "paid") {
      return NextResponse.json({ error: "Sourcing credit not found or not yet paid." }, { status: 400 });
    }

    const now = new Date();
    if (sourcingReq.credit_expires_at && new Date(sourcingReq.credit_expires_at as string) < now) {
      return NextResponse.json({ error: "This sourcing credit has expired." }, { status: 400 });
    }

    // Check if credit is currently locked by another active checkout (not expired)
    const LOCK_EXPIRY_MINUTES = 30;
    const lockExpiresAt = sourcingReq.credit_claimed_at
      ? new Date(new Date(sourcingReq.credit_claimed_at as string).getTime() + LOCK_EXPIRY_MINUTES * 60 * 1000)
      : null;
    if (lockExpiresAt && lockExpiresAt > now) {
      return NextResponse.json({ error: "This sourcing credit is currently reserved in another checkout. Please try again in 30 minutes." }, { status: 409 });
    }

    // Fetch ledger to compute available balance
    const { data: ledger } = await supabaseAdmin
      .from("sourcing_credit_ledger")
      .select("event_type, amount_cents")
      .eq("sourcing_request_id", sourcingRequestId);

    const available = computeAvailableCredit(
      sourcingReq.deposit_amount_cents as number,
      (ledger ?? []) as LedgerRow[]
    );

    if (available <= 0) {
      return NextResponse.json({ error: "No remaining credit on this sourcing request." }, { status: 400 });
    }

    // Grand total before credit (items after coupon discount + shipping + tx fee)
    const totalBeforeCredit = discountedItemsCents + transactionFeeAmount + shippingFee * 100;
    sourcingCreditApplied = Math.min(available, totalBeforeCredit);

    if (sourcingCreditApplied <= 0) {
      return NextResponse.json({ error: "Credit could not be applied to this order." }, { status: 400 });
    }

    // Atomic lock: only claims if not already claimed (or lock has expired)
    const lockExpiry = new Date(now.getTime() - LOCK_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const { data: claimResult } = await supabaseAdmin
      .from("sourcing_requests")
      .update({
        credit_claimed_at: now.toISOString(),
        credit_claimed_session_id: "pending",
        updated_at: now.toISOString(),
      })
      .eq("id", sourcingRequestId)
      .eq("payment_status", "paid")
      .or(`credit_claimed_at.is.null,credit_claimed_at.lt.${lockExpiry}`)
      .select("id");

    if (!claimResult || claimResult.length === 0) {
      return NextResponse.json({ error: "Credit was just claimed by another checkout. Please try again shortly." }, { status: 409 });
    }
  }

  // ── Create Stripe coupon for discount + sourcing credit combined ──────────────
  // Stripe doesn't allow negative line items; combine all discounts into one coupon.
  let stripeCouponId: string | null = null;
  const totalCouponCents = discountAmountCents + sourcingCreditApplied;
  if (totalCouponCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: totalCouponCents,
      currency: "usd",
      duration: "once",
      name: sourcingCreditApplied > 0
        ? discountAmountCents > 0 ? "Discount + Sourcing Credit" : "Sourcing Credit"
        : "Discount",
    });
    stripeCouponId = coupon.id;
  }

  // ── Build metadata ────────────────────────────────────────────────────────────
  const itemMetadata = encodeCheckoutItems(
    validatedItems.map((i) => ({
      productId: i.productId,
      optionId: i.optionId ?? null,
      price: i.price!,
      fulfillmentType: i.fulfillmentType,
    }))
  );

  // Also encode the customer email for webhook use
  const emailMetadata: Record<string, string> = {};
  if (body.customerEmail) {
    emailMetadata.cust_email = normalizeEmail(body.customerEmail);
  }

  // Sourcing credit metadata (for webhook to commit the ledger row)
  const sourcingMetadata: Record<string, string> = {};
  if (sourcingRequestId && sourcingCreditApplied > 0) {
    sourcingMetadata.sourcing_request_id = sourcingRequestId;
    sourcingMetadata.sourcing_credit_applied_cents = String(sourcingCreditApplied);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    shipping_address_collection: {
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
        message:
          "I agree to the [Store Policy](https://www.bingbingjade.com/policy) and [FAQ](https://www.bingbingjade.com/faq).",
      },
    },
    ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
    metadata: { ...itemMetadata, ...discountMetadata, ...emailMetadata, ...sourcingMetadata },
  });

  // Update the sourcing credit lock with the actual session ID
  if (sourcingRequestId && sourcingCreditApplied > 0) {
    await supabaseAdmin
      .from("sourcing_requests")
      .update({ credit_claimed_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", sourcingRequestId);
  }

  return NextResponse.json({ url: session.url });
}
