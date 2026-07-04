import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encodeCheckoutItems, encodeDiscountMeta } from "@/lib/stripe-metadata";
import { validateDiscount, normalizeEmail } from "@/lib/discount";
import { computeAvailableCredit } from "@/lib/sourcing-classification";
import type { LedgerRow } from "@/lib/sourcing-classification";
import type { CartItem } from "@/types/cart";
import { getShippingZone, calculateShipping, calculateStripeFee, calculateBnplFee, ALLOWED_COUNTRIES, ACTIVE_BNPL_METHODS } from "@/lib/shipping";
import { checkCustomerRestriction, logBlockedAttempt } from "@/lib/customer-restrictions";

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
    taxAmountCents?: number;
    taxCalculationId?: string;
    shippingAddress?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state?: string;
      postal: string;
      country: string;
    };
    paymentMethod?: "standard" | "bnpl";
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
      tax_behavior: "exclusive";
    };
    quantity: number;
  }[] = [];
  const validatedItems: CartItem[] = [];

  // Campaign event tracking (populated during the per-item loop)
  const itemCampaignEvents: Array<{
    productId: string;
    campaignEventId: string | null;
    campaignEventName: string | null;
    originalPrice: number | null;
    finalPrice: number;
  }> = [];
  const appliedCampaignEventIds = new Set<string>();
  let anyCampaignEventApplied = false;
  let allAppliedAllowStack = true; // flipped false if any applied campaign has allow_coupon_stack=false

  for (const item of items) {
    if (!item.productId) {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, status, price_display_usd, sale_price_usd, public_id, slug, quick_ship, reserved_until")
      .eq("id", item.productId)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ error: `Product not found: ${item.productName}` }, { status: 400 });
    }

    if (product.status === "sold") {
      return NextResponse.json({ error: `"${product.name}" has already been sold.` }, { status: 409 });
    }

    // Reserved product: verify unlock token
    if (
      product.status === "reserved" &&
      product.reserved_until &&
      new Date(product.reserved_until as string) > new Date()
    ) {
      const reservationId = item.reservationId ?? null;
      if (!reservationId) {
        return NextResponse.json(
          { error: `"${product.name}" is currently reserved. Please enter your reservation code to continue.` },
          { status: 409 }
        );
      }
      const { data: res } = await supabase
        .from("product_reservations")
        .select("id, expires_at")
        .eq("id", reservationId)
        .eq("product_id", item.productId)
        .is("cancelled_at", null)
        .maybeSingle();

      if (!res || new Date(res.expires_at as string) <= new Date()) {
        return NextResponse.json(
          { error: `"${product.name}" is currently reserved. Please enter your reservation code to continue.` },
          { status: 409 }
        );
      }
    }

    let serverPrice: number | null = null;
    // Raw option price preserved separately for campaign percent/fixed calculations.
    // When an option exists, campaign discounts should be based on the option's own price
    // rather than the product-level price_display_usd.
    let optionBasePrice: number | null = null;
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
      optionBasePrice = option.price_usd ?? null;
      serverPrice = option.price_usd ?? product.price_display_usd;
    } else {
      serverPrice = product.sale_price_usd ?? product.price_display_usd;
      // Only apply the on_sale override for non-option items; option prices are
      // self-contained and must not be clobbered by the parent product's sale price.
      if (product.status === "on_sale" && product.sale_price_usd != null) {
        serverPrice = product.sale_price_usd;
      }
    }

    // ── Campaign event price resolution ──────────────────────────────────────
    // Runs after all normal pricing is settled. For percent/fixed campaign discounts,
    // base the calculation on the option price (if any) or the product list price —
    // not on sale_price_usd — so the discount is off the real price, not a sale price.
    const campaignCalcBase = optionBasePrice ?? product.price_display_usd;
    const originalServerPrice = serverPrice;
    let appliedCampaignEventId: string | null = null;
    let appliedCampaignEventName: string | null = null;
    let appliedAllowStack = true;

    {
      const nowIso = new Date().toISOString();
      const { data: campaignRows } = await supabase
        .from("campaign_event_products")
        .select(`
          event_price_usd,
          campaign_events (
            id, name, status, discount_type, discount_value,
            allow_coupon_stack, starts_at, ends_at
          )
        `)
        .eq("product_id", item.productId);

      let bestEventPrice: number | null = null;

      for (const row of (campaignRows ?? [])) {
        const ce = row.campaign_events as unknown as {
          id: string; name: string; status: string;
          discount_type: string | null; discount_value: number | null;
          allow_coupon_stack: boolean; starts_at: string | null; ends_at: string | null;
        } | null;
        if (!ce || ce.status !== "active") continue;
        if (ce.starts_at && ce.starts_at > nowIso) continue;
        if (ce.ends_at && ce.ends_at < nowIso) continue;

        let eventPrice: number | null = null;
        if (row.event_price_usd != null) {
          // Explicit per-product event price — no further calculation needed
          eventPrice = Number(row.event_price_usd);
        } else if (ce.discount_type === "percent" && ce.discount_value != null && campaignCalcBase != null) {
          eventPrice = campaignCalcBase * (1 - (ce.discount_value as number) / 100);
        } else if (ce.discount_type === "fixed" && ce.discount_value != null && campaignCalcBase != null) {
          eventPrice = campaignCalcBase - (ce.discount_value as number);
        }

        if (eventPrice == null || eventPrice <= 0) continue;

        // Among all active campaigns that include this product, use the lowest price
        if (bestEventPrice === null || eventPrice < bestEventPrice) {
          bestEventPrice = eventPrice;
          appliedCampaignEventId = ce.id;
          appliedCampaignEventName = ce.name;
          appliedAllowStack = ce.allow_coupon_stack;
        }
      }

      // Apply only when the campaign price strictly beats the current server price
      if (
        bestEventPrice !== null &&
        originalServerPrice !== null &&
        bestEventPrice < originalServerPrice
      ) {
        serverPrice = bestEventPrice;
      } else {
        // No improvement — discard campaign attribution
        appliedCampaignEventId = null;
        appliedCampaignEventName = null;
        appliedAllowStack = true;
      }
    }

    if (appliedCampaignEventId) {
      appliedCampaignEventIds.add(appliedCampaignEventId);
      anyCampaignEventApplied = true;
      if (!appliedAllowStack) allAppliedAllowStack = false;
    }

    itemCampaignEvents.push({
      productId: item.productId,
      campaignEventId: appliedCampaignEventId,
      campaignEventName: appliedCampaignEventName,
      originalPrice: originalServerPrice,
      finalPrice: serverPrice ?? 0,
    });
    // ─────────────────────────────────────────────────────────────────────────

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
        tax_behavior: "exclusive",
      },
      quantity: 1,
    });

    const fulfillmentType = item.fulfillmentType ?? (product.quick_ship ? "available_now" : "sourced_for_you");
    validatedItems.push({ ...item, price: serverPrice, fulfillmentType });
  }

  // ── Campaign event: coupon eligibility + stacking checks ─────────────────────
  if (body.discountCode) {
    const upperCode = body.discountCode.trim().toUpperCase();

    // Determine whether this code belongs to a campaign_event
    const { data: ceForCode } = await supabase
      .from("campaign_events")
      .select("id, allow_coupon_stack")
      .eq("coupon_code", upperCode)
      .maybeSingle();

    if (ceForCode) {
      // Campaign event code — verify at least one cart product is in that campaign
      const cartProductIds = validatedItems.map((i) => i.productId);
      const { data: eligibleRows } = await supabase
        .from("campaign_event_products")
        .select("product_id")
        .eq("campaign_id", ceForCode.id)
        .in("product_id", cartProductIds);

      if (!eligibleRows || eligibleRows.length === 0) {
        return NextResponse.json(
          { error: "This code only applies to selected event items." },
          { status: 400 }
        );
      }

      // Default: no stacking. If event pricing is already baked into item prices
      // for this campaign (or any other), reject the additional coupon discount
      // unless this campaign explicitly allows it.
      if (anyCampaignEventApplied && !ceForCode.allow_coupon_stack) {
        return NextResponse.json(
          { error: "Event pricing cannot be combined with this discount code." },
          { status: 400 }
        );
      }
    } else if (anyCampaignEventApplied && !allAppliedAllowStack) {
      // A non-campaign-event discount code was entered while a non-stackable campaign
      // markdown is already priced into the items — reject the code
      return NextResponse.json(
        { error: "Event pricing cannot be combined with this discount code." },
        { status: 400 }
      );
    }
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
        ...(body.discountCode && (discountResult.source === "campaign" || discountResult.source === "campaign_event")
          ? { code: body.discountCode.trim().toUpperCase() }
          : {}),
        ...(discountResult.referrerCustomerId
          ? { referrerCustomerId: discountResult.referrerCustomerId }
          : {}),
        ...(discountResult.campaignId ? { campaignId: discountResult.campaignId } : {}),
        ...(discountResult.campaignEventId ? { campaignEventId: discountResult.campaignEventId } : {}),
      });
    }
    // Discount validation failure is non-fatal — checkout proceeds without it
  }

  // ── Validate shipping address ─────────────────────────────────────────────────
  const addr = body.shippingAddress;
  const allowedCountryCodes = new Set(ALLOWED_COUNTRIES.map((c) => c.code));
  if (!addr || !addr.name || !addr.line1 || !addr.postal || !addr.country) {
    return NextResponse.json({ error: "Shipping address is required." }, { status: 400 });
  }
  if (!allowedCountryCodes.has(addr.country)) {
    return NextResponse.json({ error: "Shipping to that country is not supported." }, { status: 400 });
  }

  // ── Customer restriction check ────────────────────────────────────────────────
  {
    const restrictionResult = await checkCustomerRestriction({
      email: body.customerEmail ?? null,
      name: addr.name,
      phone: null,
      shippingAddress: {
        line1: addr.line1,
        city: addr.city,
        state: addr.state ?? null,
        postal: addr.postal,
        country: addr.country,
      },
      customerId: null,
    });

    if (restrictionResult.blocked || restrictionResult.flagged) {
      logBlockedAttempt({
        restrictionId: restrictionResult.restrictionId!,
        matchedSignals: restrictionResult.matchedSignals ?? [],
        attemptedCustomer: {
          email: body.customerEmail ?? null,
          name: addr.name,
          line1: addr.line1,
          city: addr.city,
          state: addr.state ?? null,
          postal: addr.postal,
          country: addr.country,
        },
        cartSnapshot: {
          itemCount: validatedItems.length,
          subtotalCents: itemsSubtotalCents,
          items: validatedItems.map((i) => ({ productId: i.productId, name: i.productName, price: i.price })),
        },
      }).catch(() => {});
    }

    if (restrictionResult.blocked) {
      return NextResponse.json(
        { error: "We're unable to complete this order online at this time. Please contact us if you believe this was a mistake." },
        { status: 403 }
      );
    }
  }

  const paymentMethod = body.paymentMethod ?? "standard";
  // BNPL only allowed for US shipping
  if (paymentMethod === "bnpl" && addr.country !== "US") {
    return NextResponse.json({ error: "Installment payments are only available for US shipping addresses." }, { status: 400 });
  }

  // ── Build shipping + fee line items ──────────────────────────────────────────
  const hasSourcingItems = validatedItems.some((i) => (i.fulfillmentType ?? "sourced_for_you") === "sourced_for_you");
  const isPrioritySourcing = body.expedited && hasSourcingItems;
  const zone = getShippingZone(addr.country);
  const shippingFee = isPrioritySourcing
    ? 100 + (validatedItems.length - 1) * 10
    : calculateShipping(zone, validatedItems.length);
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
      tax_behavior: "exclusive",
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
        tax_behavior: "exclusive",
      },
      quantity: 1,
    });
  }

  // Transaction fee: gross-up so seller nets full amount after Stripe deducts their fee.
  // Domestic (US): 2.9% + $0.30 | International: 4.4% + $0.30
  const discountedItemsCents = Math.max(0, itemsSubtotalCents - discountAmountCents);

  // Tax (WA state only, pre-calculated via stripe.tax.calculations)
  const taxAmountCents = typeof body.taxAmountCents === "number" ? body.taxAmountCents : 0;
  if (taxAmountCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Washington State Sales Tax" },
        unit_amount: taxAmountCents,
        tax_behavior: "exclusive",
      },
      quantity: 1,
    });
  }

  const subtotalForFeeCents = discountedItemsCents + insuranceFeeCents + shippingFee * 100 + taxAmountCents;
  const transactionFeeAmount = paymentMethod === "bnpl"
    ? calculateBnplFee(subtotalForFeeCents)
    : calculateStripeFee(subtotalForFeeCents, zone);
  const feeLabel = paymentMethod === "bnpl" ? "Installment Fee" : "Transaction Fee";
  lineItems.push({
    price_data: {
      currency: "usd",
      product_data: { name: feeLabel },
      unit_amount: transactionFeeAmount,
      tax_behavior: "exclusive",
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
  // Campaign event session metadata — compact, stays well within Stripe's 500-char limit
  const campaignEventMetadata: Record<string, string> = {};
  if (anyCampaignEventApplied) {
    campaignEventMetadata.ce_applied = "1";
    // Encode up to 5 campaign event IDs (UUIDs are 36 chars; 5 × 37 = 185 chars)
    campaignEventMetadata.ce_ids = [...appliedCampaignEventIds].slice(0, 5).join(",");
    campaignEventMetadata.ce_allow_stack = allAppliedAllowStack ? "1" : "0";
  }

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

  // Shipping address metadata (for webhook — customer won't re-enter on Stripe)
  const addrMetadata: Record<string, string> = {
    ship_name: addr.name,
    ship_line1: addr.line1,
    ship_city: addr.city,
    ship_postal: addr.postal,
    ship_country: addr.country,
    ...(addr.line2 ? { ship_line2: addr.line2 } : {}),
    ...(addr.state ? { ship_state: addr.state } : {}),
  };

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    const taxMeta: Record<string, string> = {};
    if (body.taxCalculationId) {
      taxMeta.tax_calculation_id = body.taxCalculationId;
    }

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "usd",
      payment_method_types: paymentMethod === "bnpl"
        ? ACTIVE_BNPL_METHODS
        : ["card"],
      ...(body.customerEmail ? { customer_email: normalizeEmail(body.customerEmail) } : {}),
      line_items: lineItems,
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
      metadata: {
        ...itemMetadata,
        ...discountMetadata,
        ...emailMetadata,
        ...sourcingMetadata,
        ...addrMetadata,
        ...taxMeta,
        ...campaignEventMetadata,
        payment_method: paymentMethod,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe/checkout] session creation failed:", message);
    if (
      message.includes("payment_method_types") ||
      message.includes("not supported")
    ) {
      return NextResponse.json(
        { error: "One or more installment payment methods are not available in your region. Please use Standard payment." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `Stripe error: ${message}` }, { status: 500 });
  }

  // Update the sourcing credit lock with the actual session ID
  if (sourcingRequestId && sourcingCreditApplied > 0) {
    await supabaseAdmin
      .from("sourcing_requests")
      .update({ credit_claimed_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", sourcingRequestId);
  }

  return NextResponse.json({ url: session.url });
}
