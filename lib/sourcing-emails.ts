/**
 * sourcing-emails.ts — Email notifications for the custom sourcing workflow.
 * Uses Resend. SERVER-SIDE ONLY.
 */

import { Resend } from "resend";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const ADMIN_EMAIL = "bingbing.jade2@gmail.com";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function brandedLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#065f46;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Custom Sourcing</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;">BingBing Jade</h1>
          </td>
        </tr>
        <tr><td style="padding:36px 40px;">${content}</td></tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── New request → admin notification ─────────────────────────────────────────

export async function sendAdminNewRequestEmail(params: {
  sourcingRequestId: string;
  customerName: string;
  customerEmail: string;
  category: string;
  requestType: string;
  depositCents: number;
  budgetMin: number;
  budgetMax?: number | null;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const adminUrl = `${SITE_URL}/sourcing-admin/${params.sourcingRequestId}`;
  const deposit = `$${(params.depositCents / 100).toFixed(0)}`;
  const budget = params.budgetMax
    ? `$${params.budgetMin}–$${params.budgetMax}`
    : `$${params.budgetMin}+`;
  const tier = params.requestType.charAt(0).toUpperCase() + params.requestType.slice(1);

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">New sourcing request received.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Customer:</strong> ${params.customerName} &lt;${params.customerEmail}&gt;</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Category:</strong> ${params.category.charAt(0).toUpperCase() + params.category.slice(1)}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Tier:</strong> ${tier}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Budget:</strong> ${budget}</p>
        <p style="margin:0;font-size:13px;color:#374151;"><strong>Deposit paid:</strong> ${deposit}</p>
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
          View Request &rarr;
        </a>
      </td></tr>
    </table>
  `;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>",
      to: ADMIN_EMAIL,
      subject: `[New Sourcing Request] ${params.customerName} — ${tier} ${params.category}`,
      html: brandedLayout(content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Admin notification failed:", err);
  }
}

// ── Attempt sent → customer email ─────────────────────────────────────────────

export async function sendAttemptEmail(params: {
  customerName: string;
  customerEmail: string;
  publicToken: string;
  attemptNumber: number;
  maxAttempts: number;
  responseDueAt: string;
  optionCount: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const firstName = params.customerName.split(" ")[0];
  const trackUrl = `${SITE_URL}/custom-sourcing/${params.publicToken}`;
  const deadline = new Date(params.responseDueAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      We've completed round ${params.attemptNumber} of your custom sourcing request and have
      ${params.optionCount} option${params.optionCount !== 1 ? "s" : ""} ready for you to review.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">Round ${params.attemptNumber} of ${params.maxAttempts}</p>
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#065f46;">${params.optionCount} option${params.optionCount !== 1 ? "s" : ""} ready to review</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Please respond by <strong>${deadline}</strong> (72 hours). After this window, the round expires.</p>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
      You can like, dislike, or leave feedback on each option — and accept the one you'd like to proceed with.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
          Review Options &rarr;
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      This link is private and tied to your request. Keep it safe.
      Questions? <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none;">Contact us</a>.
    </p>
  `;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>",
      to: params.customerEmail,
      bcc: ADMIN_EMAIL,
      subject: `[BingBing Jade] Your sourcing options are ready — Round ${params.attemptNumber}`,
      html: brandedLayout(content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Attempt email failed:", err);
  }
}

// ── Checkout offer → customer email ───────────────────────────────────────────

export async function sendCheckoutOfferEmail(params: {
  customerName: string;
  customerEmail: string;
  publicToken: string;
  offerToken: string;
  itemTitle: string;
  finalAmountCents: number;
  creditAppliedCents: number;
  expiresAt: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const firstName = params.customerName.split(" ")[0];
  const checkoutUrl = `${SITE_URL}/custom-sourcing/${params.publicToken}/checkout/${params.offerToken}`;
  const expires = new Date(params.expiresAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const total = `$${(params.finalAmountCents / 100).toFixed(2)}`;
  const credit = params.creditAppliedCents > 0
    ? `<p style="margin:0 0 4px;font-size:13px;color:#374151;">Sourcing credit applied: <strong>−$${(params.creditAppliedCents / 100).toFixed(2)}</strong></p>`
    : "";

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Great news! Your private checkout is ready for <strong>${params.itemTitle}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#065f46;">${params.itemTitle}</p>
        ${credit}
        <p style="margin:0 0 4px;font-size:13px;color:#374151;">Total due: <strong>${total}</strong></p>
        <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Offer expires ${expires}.</p>
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${checkoutUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
          Complete Your Purchase &rarr;
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      This checkout link is private. Your sourcing deposit has been applied as credit.
      Questions? <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none;">Contact us</a>.
    </p>
  `;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>",
      to: params.customerEmail,
      bcc: ADMIN_EMAIL,
      subject: `[BingBing Jade] Your private checkout is ready`,
      html: brandedLayout(content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Checkout offer email failed:", err);
  }
}
