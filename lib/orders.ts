/**
 * Order / customer utilities — used by the Stripe webhook and admin API routes.
 *
 * All functions use supabaseAdmin (service-role key) and are server-side only.
 * None of these functions should ever be imported in client components.
 */

import { supabaseAdmin } from "./supabase-admin";

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
  items: { name: string; option?: string | null; price: number; quantity?: number }[];
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

  const itemRows = params.items
    .map((i) => {
      const qty = i.quantity && i.quantity > 1 ? ` &times; ${i.quantity}` : "";
      const label = i.option ? `${i.name} &mdash; ${i.option}` : i.name;
      const lineTotal = i.price * (i.quantity ?? 1);
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">
            ${label}${qty}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;white-space:nowrap;">
            $${lineTotal.toFixed(2)}
          </td>
        </tr>`;
    })
    .join("");

  const deliveryNote =
    params.estimatedDelivery
      ? `Estimated delivery: <strong>${params.estimatedDelivery}</strong>`
      : "We will be in touch once your order ships. Authentic jade sourcing, certification, and international shipping take time — typically 2–6 weeks.";

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
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td colspan="2" style="padding-bottom:8px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Order Summary</td>
              </tr>
              ${itemRows}
              <tr>
                <td style="padding:14px 0 0;font-size:14px;font-weight:600;color:#111827;">Total paid</td>
                <td style="padding:14px 0 0;font-size:15px;font-weight:700;color:#065f46;text-align:right;">${amountFormatted}</td>
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
