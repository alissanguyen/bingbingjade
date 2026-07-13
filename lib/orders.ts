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

  const sa = params.shippingAddress;
  const addrName = sa?.name ?? params.customerName;
  const hasAddress = !!sa?.line1;
  const line2 = sa?.line2 ? `<br>${sa.line2}` : "";
  const cityLine = [sa?.city, sa?.state, sa?.postal].filter(Boolean).join(", ");
  const country = sa?.country && sa.country !== "US" ? `<br>${sa.country}` : "";

  const shippingBlock = `
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
    </table>
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
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for your order. Because this piece is <strong>Sourced for You</strong>, we're now confirming
              availability with our overseas sourcing partner before anything is finalized.
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
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:28px;">
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

            ${buildItemRowsHtml(params.items)}

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:20px 0 28px;">
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
      subject: `[Order Received] Confirming Availability for Your Order ${params.orderNumber}`,
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
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
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
