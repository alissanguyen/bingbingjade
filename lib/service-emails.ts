/**
 * service-emails.ts — Email notifications for the generalized Service
 * Request platform (Restoration & Preservation today, any future service
 * tomorrow). Uses Resend, following the same per-function
 * build-html-and-send convention as lib/orders.ts / lib/sourcing-emails.ts
 * (no shared send primitive exists in this codebase yet — see those files).
 *
 * SERVER-SIDE ONLY.
 */

import { Resend } from "resend";
import type { ServiceRequestRow, ServiceRow } from "./service-requests";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const ADMIN_EMAIL = "contact@bingbingjade.com";
const BANNER_IMAGE = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>";
}

function layout(bannerHeadline: string, bannerEyebrow: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }
    .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    @media only screen and (max-width:640px) { .email-body { padding: 32px 24px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:800px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding:0;margin:0;">
            <div style="background-image:url('${BANNER_IMAGE}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="180" style="background:linear-gradient(135deg,rgba(2,44,34,0.88) 0%,rgba(6,95,70,0.75) 60%,rgba(0,0,0,0.45) 100%);padding:36px 64px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;"><font color="#6ee7b7">${bannerEyebrow}</font></p>
                    <h1 class="banner-heading" style="margin:0;font-size:28px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;"><font color="#ffffff">${bannerHeadline}</font></h1>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <tr><td class="email-body" style="padding:40px 64px 36px;">${content}</td></tr>
        <tr>
          <td style="padding:20px 64px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} BingBing Jade &middot; <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a></p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:${ADMIN_EMAIL}" style="color:#9ca3af;text-decoration:none;">${ADMIN_EMAIL}</a>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const DISCLAIMER = `
  <div style="margin-top:28px;padding:16px 18px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#57534e;">Please note</p>
    <p style="margin:0;font-size:12px;color:#78716c;line-height:1.6;">
      Photo review is preliminary only. Photos may not reveal hidden cracks, treatments, structural weakness, or
      previous repairs. Final acceptance remains subject to physical inspection once we receive your piece. The
      recommended service, price, or feasibility may change after inspection — we will always contact you before
      any materially different work or additional charge is approved.
    </p>
  </div>`;

function trackerUrl(publicToken: string): string {
  return `${SITE_URL}/service-requests/${publicToken}`;
}

function money(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

// ── Request received (copy varies by workflow mode) ────────────────────────

export async function sendServiceRequestReceivedEmail(params: {
  serviceRequest: ServiceRequestRow;
  service: ServiceRow;
  mode: "instant_purchase" | "authorization_hold" | "quote_required";
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service, mode } = params;
  if (!sr.customer_email) return;

  const bodyByMode: Record<typeof mode, string> = {
    instant_purchase: `
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Thank you for booking <strong>${service.name}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
        We received your service request and photos. You'll receive shipping instructions shortly — please
        package your piece carefully and ship it once you have those instructions.
      </p>`,
    authorization_hold: `
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Thank you for your <strong>${service.name}</strong> request.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
        We received your service request and photos. We've placed an authorization hold of <strong>${money(sr.price_cents)}</strong>
        on your card — <strong>you have not been charged yet</strong>. Our specialists are reviewing the condition of your
        jade item before confirming whether we can accept the requested service.
      </p>
      <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#b45309;line-height:1.7;">
        Please do NOT ship your item yet. We'll contact you shortly with our decision and, if approved, shipping instructions.
      </p>`,
    quote_required: `
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Thank you for your <strong>${service.name}</strong> request.</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
        We received your service request and photos. Our specialists are preparing your quote based on the condition
        of your jade item. No payment has been collected. We'll contact you shortly with a personalized quote.
      </p>
      <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#b45309;line-height:1.7;">
        Please do not ship your item until you receive your quote and approve it.
      </p>`,
  };

  const content = `
    ${bodyByMode[mode]}
    <table cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Track Your Request &rarr;</a>
      </td></tr>
    </table>
    ${DISCLAIMER}
  `;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `We received your ${service.name} request — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("Request Received", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] request-received send failed:", err);
  }
}

// ── Admin: new request submitted ────────────────────────────────────────────

export async function sendAdminNewServiceRequestEmail(params: { serviceRequest: ServiceRequestRow; service: ServiceRow }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service } = params;
  const adminUrl = `${SITE_URL}/admin/service-requests/${sr.id}`;

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">New service request submitted.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Service:</strong> ${service.name}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Customer:</strong> ${sr.customer_name ?? ""} &lt;${sr.customer_email ?? ""}&gt;</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Status:</strong> ${sr.status}</p>
        ${sr.price_cents ? `<p style="margin:0;font-size:13px;color:#374151;"><strong>Amount:</strong> ${money(sr.price_cents)}</p>` : ""}
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review Request &rarr;</a>
      </td></tr>
    </table>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: ADMIN_EMAIL,
      subject: `[New Service Request] ${sr.customer_name ?? "Customer"} — ${service.name}`,
      html: layout("New Service Request", "BingBing Jade · Admin", content),
    });
  } catch (err) {
    console.error("[service-emails] admin new-request send failed:", err);
  }
}

// ── More images requested ───────────────────────────────────────────────────

export async function sendMoreImagesRequestedEmail(params: {
  serviceRequest: ServiceRequestRow;
  service: ServiceRow;
  instructions: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service, instructions } = params;
  if (!sr.customer_email) return;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">We need a few more photos of your ${service.name.toLowerCase()} request.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px 20px;"><p style="margin:0;font-size:13px;color:#78350f;line-height:1.7;">${instructions}</p></td></tr>
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">Please use the secure link below to add your additional photos — your previous photos are already saved.</p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Upload More Photos &rarr;</a>
      </td></tr>
    </table>
    ${DISCLAIMER}`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `Additional photos needed — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("More Photos Needed", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] more-images-requested send failed:", err);
  }
}

// ── Quote ready ──────────────────────────────────────────────────────────────

export async function sendQuoteReadyEmail(params: { serviceRequest: ServiceRequestRow; service: ServiceRow }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service } = params;
  if (!sr.customer_email) return;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">Your quote for <strong>${service.name}</strong> is ready.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#065f46;">${money(sr.quote_amount_cents)}</p>
        ${sr.quote_notes ? `<p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${sr.quote_notes}</p>` : ""}
      </td></tr>
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
      Review the details and accept your quote to proceed with payment and shipping instructions.
      ${sr.quote_expires_at ? `This quote is valid until ${new Date(sr.quote_expires_at).toLocaleDateString()}.` : ""}
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Review &amp; Accept Quote &rarr;</a>
      </td></tr>
    </table>
    ${DISCLAIMER}`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `Your ${service.name} quote is ready — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("Your Quote Is Ready", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] quote-ready send failed:", err);
  }
}

// ── Shipping instructions (sent only after approval / quote-payment) ──────

export async function sendShippingInstructionsEmail(params: { serviceRequest: ServiceRequestRow; service: ServiceRow }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service } = params;
  if (!sr.customer_email) return;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">Your ${service.name} request has been approved.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
      You may now ship your piece to us. Please package it carefully — we recommend a padded box with bubble wrap
      and, for higher-value pieces, shipping insurance.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View Shipping Details &rarr;</a>
      </td></tr>
    </table>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `Shipping instructions — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("Ready to Ship", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] shipping-instructions send failed:", err);
  }
}

// ── Authorization released / request declined ─────────────────────────────

export async function sendAuthorizationReleasedServiceEmail(params: {
  serviceRequest: ServiceRequestRow;
  service: ServiceRow;
  reason?: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service, reason } = params;
  if (!sr.customer_email) return;

  const wasAuthorized = !!sr.authorized_amount;
  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">Update on your ${service.name} request.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
      After reviewing your submitted photos, we're not able to proceed with this request as described.
      ${reason ? `${reason}` : ""}
    </p>
    ${wasAuthorized
      ? `<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">The card authorization hold we placed has been released — <strong>no charge was made and no refund is needed</strong>, since nothing was captured.</p>`
      : ""}
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">If you have questions or would like to discuss alternatives, just reply to this email.</p>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `Update on your ${service.name} request — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("Request Update", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] authorization-released send failed:", err);
  }
}

// ── Generic lifecycle status update (received / in_progress / QC / return / completed) ──

const STATUS_COPY: Record<string, { headline: string; body: (sr: ServiceRequestRow) => string }> = {
  received: { headline: "Item Received", body: () => "We've received your item and it's now in our queue for inspection." },
  in_progress: { headline: "Work Started", body: () => "Our specialists have begun work on your piece." },
  quality_control: { headline: "Quality Control", body: () => "Your piece has completed work and is now in quality control." },
  ready_to_return: { headline: "Ready to Ship Back", body: () => "Your piece is packaged and ready to ship back to you." },
  shipped_back: {
    headline: "On Its Way Back",
    body: (sr) => (sr.return_tracking_number ? `Your piece has shipped. Tracking number: <strong>${sr.return_tracking_number}</strong>${sr.return_carrier ? ` (${sr.return_carrier})` : ""}.` : "Your piece has shipped back to you."),
  },
  completed: { headline: "Service Completed", body: () => "Your service request is complete. Thank you for trusting us with your piece." },
};

export async function sendServiceStatusEmail(params: { serviceRequest: ServiceRequestRow; service: ServiceRow; status: keyof typeof STATUS_COPY }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service, status } = params;
  if (!sr.customer_email) return;
  const copy = STATUS_COPY[status];
  if (!copy) return;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">${copy.headline} — ${service.name}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">${copy.body(sr)}</p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Track Your Request &rarr;</a>
      </td></tr>
    </table>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `${copy.headline} — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout(copy.headline, "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] status-update send failed:", err);
  }
}

// ── Generic admin notification (quote awaiting response, images uploaded, authorization expiring) ──

export async function sendAdminServiceNotification(params: { serviceRequest: ServiceRequestRow; subject: string; message: string }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, subject, message } = params;
  const adminUrl = `${SITE_URL}/admin/service-requests/${sr.id}`;

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">${message}</p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open Request &rarr;</a>
      </td></tr>
    </table>`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: ADMIN_EMAIL,
      subject: `[Service Request] ${subject}`,
      html: layout(subject, "BingBing Jade · Admin", content),
    });
  } catch (err) {
    console.error("[service-emails] admin notification send failed:", err);
  }
}

// ── Manual acknowledgment (used for the #1330-3268-style backfill flow) ────

export async function sendManualAcknowledgmentEmail(params: { serviceRequest: ServiceRequestRow; service: ServiceRow }): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const { serviceRequest: sr, service } = params;
  if (!sr.customer_email) return;

  const content = `
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">Thank you for your ${service.name} order.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
      We're following up to confirm your request and get a full picture of your piece before we begin. Please use
      the secure link below to upload 1–5 clear photos so our specialists can review its condition.
    </p>
    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#b45309;line-height:1.7;">
      Please do not ship your item yet — we'll follow up with shipping instructions once your photos are reviewed and approved.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackerUrl(sr.public_token)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Upload Your Photos &rarr;</a>
      </td></tr>
    </table>
    ${DISCLAIMER}`;

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: sr.customer_email,
      subject: `Action needed: photos for your ${service.name} order — ${sr.request_number ?? sr.id.slice(0, 8)}`,
      html: layout("Please Upload Photos", "BingBing Jade · Restoration & Preservation", content),
    });
  } catch (err) {
    console.error("[service-emails] manual-acknowledgment send failed:", err);
  }
}
