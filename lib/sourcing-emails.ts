/**
 * sourcing-emails.ts — Email notifications for the custom sourcing workflow.
 * Uses Resend. SERVER-SIDE ONLY.
 */

import { Resend } from "resend";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const ADMIN_EMAIL = "contact@bingbingjade.com";
const JADE_BANNER = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function brandedLayout(bannerHeadline: string, bannerEyebrow: string, content: string): string {
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
    [data-ogsc] .banner-eyebrow, [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading, [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    @media only screen and (max-width:640px) { .email-body { padding: 32px 24px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:800px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:800px;height:220px;">
              <v:fill type="frame" src="${JADE_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${JADE_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="220" style="background:linear-gradient(135deg,rgba(2,44,34,0.88) 0%,rgba(6,95,70,0.75) 60%,rgba(0,0,0,0.45) 100%);padding:44px 64px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">${bannerEyebrow}</font></p>
                    <h1 class="banner-heading" style="margin:0;font-size:32px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.02em;"><font color="#ffffff">${bannerHeadline}</font></h1>
                  </td>
                </tr>
              </table>
            </div>
            <!--[if mso]>
              </v:textbox>
            </v:rect>
            <![endif]-->
          </td>
        </tr>

        <!-- ═══ BODY ═══ -->
        <tr>
          <td class="email-body" style="padding:44px 64px 40px;">
            ${content}
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:20px 64px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
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
      html: brandedLayout("New Sourcing Request", "BingBing Jade \u00b7 Admin", content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Admin notification failed:", err);
  }
}

// ── Deposit confirmed → customer confirmation ─────────────────────────────────

export async function sendDepositConfirmationEmail(params: {
  customerName: string;
  customerEmail: string;
  publicToken: string;
  category: string;
  requestType: string;
  depositCents: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const firstName = params.customerName.split(" ")[0];
  const trackUrl  = `${SITE_URL}/custom-sourcing/${params.publicToken}`;
  const tier      = params.requestType.charAt(0).toUpperCase() + params.requestType.slice(1);
  const deposit   = `$${(params.depositCents / 100).toFixed(0)}`;
  const category  = params.category.charAt(0).toUpperCase() + params.category.slice(1);

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your custom sourcing request has been confirmed! We&rsquo;ve received your ${deposit} deposit
      and will begin personally sourcing your <strong>${category}</strong> through our trusted network (${tier} tier).
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;font-weight:600;">Your request is now secured and in progress.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">What happens next</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">
          We&rsquo;ll search our trusted vendor network for carefully selected options that match your preferences.
          Once we have options ready, you&rsquo;ll receive another email with a link to review and respond.
          This typically takes a few business days.
        </p>
      </td></tr>
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#374151;">
      You can check the status of your request anytime using the link below &mdash; bookmark it for easy access.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
          View My Request &rarr;
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
      This link is private and tied to your request &mdash; keep it safe.
      Have questions? We are <a href="${SITE_URL}/contact" style="color:#059669;text-decoration:none;">here</a> to help.
    </p>
  `;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FORM_SOURCING_CONFIRMATION ?? "BingBing Jade <sourcing@bingbingjade.com>",
      to:   params.customerEmail,
      bcc:  ADMIN_EMAIL,
      subject: `[BingBing Jade] Your custom sourcing request is confirmed`,
      html: brandedLayout("Your Request is Confirmed", "BingBing Jade \u00b7 Custom Sourcing", content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Deposit confirmation email failed:", err);
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
  const deadline = new Date(params.responseDueAt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Los_Angeles", timeZoneName: "short",
  });
  const optionWord = params.optionCount !== 1 ? "options" : "option";

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      We&rsquo;ve completed round ${params.attemptNumber} of your custom sourcing request and have
      <strong>${params.optionCount} ${optionWord}</strong> ready for you to review.
    </p>

    <!-- Round badge -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#059669;">Round ${params.attemptNumber} of ${params.maxAttempts}</p>
        <p style="margin:0 0 10px;font-size:22px;font-weight:700;color:#065f46;line-height:1.2;">${params.optionCount} ${optionWord} ready to review</p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          Please respond by <strong style="color:#374151;">${deadline}</strong> (72 hours).<br>After this window, the round expires.
        </p>
      </td></tr>
    </table>

    <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.65;">
      You can like, dislike, or leave feedback on each option &mdash; and accept the one you&rsquo;d like to proceed with.
    </p>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${trackUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
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
      html: brandedLayout("Your Options Are Ready", "BingBing Jade \u00b7 Custom Sourcing", content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Attempt email failed:", err);
  }
}

// ── Checkout offer → customer email ───────────────────────────────────────────

export async function sendCheckoutOfferEmail(params: {
  customerName: string;
  customerEmail: string;
  offerToken: string;
  itemTitle: string;
  priceCents: number;
  creditAppliedCents: number;
  expiresAt: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const firstName = params.customerName.split(" ")[0];
  const checkoutUrl = `${SITE_URL}/checkout/custom-sourcing/${params.offerToken}`;
  const expires = new Date(params.expiresAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const itemPrice = `$${(params.priceCents / 100).toFixed(2)}`;
  const credit = params.creditAppliedCents > 0
    ? `<p style="margin:0 0 6px;font-size:13px;color:#374151;">Sourcing deposit credit: <strong style="color:#065f46;">&minus;$${(params.creditAppliedCents / 100).toFixed(2)}</strong></p>`
    : "";

  const content = `
    <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Great news &mdash; your private checkout is ready for <strong>${params.itemTitle}</strong>.
    </p>

    <!-- Item summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:22px 28px;">
        <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#065f46;">${params.itemTitle}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#374151;">Item price: <strong>${itemPrice}</strong></p>
        ${credit}
        <p style="margin:0 0 8px;font-size:13px;color:#374151;">Shipping &amp; fees calculated at checkout based on your address.</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Offer expires ${expires}.</p>
      </td></tr>
    </table>

    <!-- CTA -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr><td style="background:#065f46;border-radius:999px;">
        <a href="${checkoutUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
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
      html: brandedLayout("Your Checkout Is Ready", "BingBing Jade \u00b7 Custom Sourcing", content),
    });
  } catch (err) {
    console.error("[sourcing-emails] Checkout offer email failed:", err);
  }
}
