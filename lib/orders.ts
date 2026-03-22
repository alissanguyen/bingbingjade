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

// ── Confirmation email ────────────────────────────────────────────────────────

/**
 * Send a branded order confirmation email via the EmailJS REST API.
 *
 * Requires env vars:
 *   EMAILJS_ORDER_CONFIRMATION_TEMPLATE_ID  — the EmailJS template ID
 *   NEXT_PUBLIC_EMAILJS_SERVICE_ID          — EmailJS service ID (already set)
 *   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY          — EmailJS public key (already set)
 *   EMAILJS_PRIVATE_KEY                     — optional, recommended for server calls
 *
 * Template variables used (configure in EmailJS dashboard):
 *   {{order_number}}, {{customer_name}}, {{customer_email}}, {{to_email}},
 *   {{to_name}}, {{order_date}}, {{amount_total}}, {{items_summary}},
 *   {{track_order_url}}, {{estimated_delivery}}
 *
 * Silently skips if EMAILJS_ORDER_CONFIRMATION_TEMPLATE_ID is not set.
 */
export async function sendOrderConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amountTotalCents: number;
  items: { name: string; option?: string | null; price: number; quantity?: number }[];
  estimatedDelivery?: string | null;
}): Promise<void> {
  const templateId = process.env.EMAILJS_ORDER_CONFIRMATION_TEMPLATE_ID;
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (!templateId || !serviceId || !publicKey) {
    // Not configured yet — skip silently
    console.info("[orders] Order confirmation email skipped (template not configured)");
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const amountFormatted = `$${(params.amountTotalCents / 100).toFixed(2)}`;
  const itemsSummary = params.items
    .map((i) => {
      const qty = i.quantity && i.quantity > 1 ? ` × ${i.quantity}` : "";
      const label = i.option ? `${i.name} — ${i.option}` : i.name;
      return `${label}${qty}  ($${i.price.toFixed(2)})`;
    })
    .join("\n");

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    ...(process.env.EMAILJS_PRIVATE_KEY ? { accessToken: process.env.EMAILJS_PRIVATE_KEY } : {}),
    template_params: {
      order_number: params.orderNumber,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      to_email: params.customerEmail,
      to_name: params.customerName,
      order_date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      amount_total: amountFormatted,
      items_summary: itemsSummary,
      track_order_url: `${siteUrl}/orders/${params.orderNumber}`,
      estimated_delivery:
        params.estimatedDelivery ??
        "We will notify you once your order ships. Fulfillment typically takes 2–4 weeks.",
    },
  };

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[orders] EmailJS responded with error:", res.status, text);
    }
  } catch (err) {
    console.error("[orders] Failed to send confirmation email:", err);
  }
}
