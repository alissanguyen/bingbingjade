/**
 * Order / customer utilities — used by the Stripe webhook and admin API routes.
 *
 * All functions use supabaseAdmin (service-role key) and are server-side only.
 * None of these functions should ever be imported in client components.
 */

import { supabaseAdmin } from "./supabase-admin";
import { resolveFirstImageUrl } from "./storage";

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
export async function sendOrderConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amountTotalCents: number;
  items: EmailItem[];
  estimatedDelivery?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[orders] Resend not configured — skipping confirmation email");
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "BingBing Jade <orders@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

  const amountFormatted = `$${(params.amountTotalCents / 100).toFixed(2)}`;
  const trackUrl = `${siteUrl}/orders/${params.orderNumber}`;
  const orderDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const firstName = params.customerName.split(" ")[0];

  const itemRows = buildItemRowsHtml(params.items);

  const deliveryNote =
    params.estimatedDelivery
      ? `Estimated delivery: <strong>${params.estimatedDelivery}</strong>`
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
            </p>
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
      subject: `Your BingBing Jade Order ${params.orderNumber} is Confirmed`,
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
  order_created: null, // no customer-facing email for this internal state
  order_confirmed: {
    subject: "Your BingBing Jade Order is Confirmed",
    headline: "Order Confirmed",
    badge: "Confirmed",
    body: "Your order has been confirmed and our team is personally reviewing it. We will reach out within 24–48 hours to coordinate the next steps.",
  },
  quality_control: {
    subject: "Your Piece is Being Inspected",
    headline: "Quality Inspection",
    badge: "Quality Control",
    body: "Your jade piece is currently undergoing our quality control inspection to ensure it meets our exacting standards before it moves to the next stage.",
  },
  certifying: {
    subject: "Your Piece is Being Certified",
    headline: "Certification in Progress",
    badge: "Certifying",
    body: "Your piece is currently being certified for authenticity and quality. This important step ensures you receive a fully verified, genuine piece.",
  },
  inbound_shipping: {
    subject: "Your Piece is On Its Way to Us",
    headline: "Inbound Shipping",
    badge: "Inbound Shipping",
    body: "Your piece is currently being shipped to our fulfillment location. Once it arrives and passes final inspection, we will ship it directly to you.",
  },
  outbound_shipping: {
    subject: "Your Order Has Shipped!",
    headline: "Your Order Has Shipped",
    badge: "Shipped",
    body: "Great news — your BingBing Jade order is on its way to you! You will receive your piece soon.",
  },
  delivered: {
    subject: "Your Order Has Been Delivered",
    headline: "Order Delivered",
    badge: "Delivered",
    body: "Your BingBing Jade order has been marked as delivered. We hope you absolutely love your piece. If you have any questions or concerns, please don't hesitate to reach out.",
  },
  order_cancelled: {
    subject: "Your BingBing Jade Order Has Been Cancelled",
    headline: "Order Cancelled",
    badge: "Cancelled",
    body: "Your order has been cancelled. If this was unexpected or you have any questions, please reach out to us and we will be happy to assist you.",
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
    .select("product_name, option_label, price_usd, quantity, product_id")
    .eq("order_id", orderId);

  if (!rows?.length) return [];

  const productIds = rows.map((r) => r.product_id).filter((id): id is string => !!id);
  let imageMap: Record<string, string> = {};

  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, images")
      .in("id", productIds);

    const resolved = await Promise.all(
      (products ?? []).map(async (p) => {
        const url = await resolveFirstImageUrl(p.images as string[]);
        return [p.id, url ?? ""] as [string, string];
      })
    );
    imageMap = Object.fromEntries(resolved);
  }

  return rows.map((r) => ({
    name: r.product_name,
    option: r.option_label,
    price: r.price_usd ?? 0,
    quantity: r.quantity ?? 1,
    imageUrl: r.product_id ? (imageMap[r.product_id] ?? null) : null,
  }));
}

export type EmailItem = {
  name: string;
  option?: string | null;
  price: number;
  quantity?: number;
  imageUrl?: string | null;
};

// Shared helper — same item-row HTML used in all email templates
function buildItemRowsHtml(items: EmailItem[]): string {
  if (!items.length) return "";
  const rows = items
    .map((i) => {
      const qty = i.quantity && i.quantity > 1 ? ` &times; ${i.quantity}` : "";
      const label = i.option ? `${i.name} &mdash; ${i.option}` : i.name;
      const lineTotal = i.price * (i.quantity ?? 1);
      const imgCell = i.imageUrl
        ? `<td style="width:56px;padding-right:14px;vertical-align:middle;">
            <img src="${i.imageUrl}" width="56" height="56" alt="" style="display:block;border-radius:8px;object-fit:cover;width:56px;height:56px;" />
          </td>`
        : `<td style="width:56px;padding-right:14px;vertical-align:middle;">
            <div style="width:56px;height:56px;border-radius:8px;background:#ecfdf5;"></div>
          </td>`;
      return `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0" width="100%"><tr>
              ${imgCell}
              <td style="vertical-align:middle;color:#374151;font-size:14px;">${label}${qty}</td>
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

  const ctaSection = !isCancelled
    ? `<table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#065f46;border-radius:999px;">
            <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
              Track Your Order &rarr;
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
            </p>
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
      subject: `${meta.subject} — ${params.orderNumber}`,
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
            </p>
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
      subject: `Delivery Update for Your Order ${params.orderNumber}`,
      html,
    });
    if (error) console.error("[orders] Resend delivery email error:", error);
  } catch (err) {
    console.error("[orders] Failed to send delivery date email:", err);
  }
}
