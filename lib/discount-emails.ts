/**
 * Discount & referral email functions.
 * All use Resend, matching the style of existing order emails in lib/orders.ts.
 */

import { Resend } from "resend";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com"
  ).replace(/\/$/, "");
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const JADE_BANNER =
  "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

// ── Welcome subscriber email ─────────────────────────────────────────────────

function buildWelcomeCouponHtml(params: {
  email: string;
  couponCode: string;
  expiresAt: Date;
  siteUrl: string;
}): string {
  const { email, couponCode, expiresAt, siteUrl } = params;
  const unsubscribeUrl = `${siteUrl}/api/unsubscribe?e=${Buffer.from(email).toString("base64")}`;
  const expiryStr = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

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

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:900px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:900px;height:240px;">
              <v:fill type="frame" src="${JADE_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${JADE_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:240px;">
                <tr>
                  <td height="240" style="background:linear-gradient(135deg,rgba(2,44,34,0.85) 0%,rgba(6,95,70,0.75) 60%,rgba(0,0,0,0.45) 100%);padding:48px 64px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">BingBing Jade &nbsp;&middot;&nbsp; Welcome</font></p>
                    <h1 class="banner-heading" style="margin:0;font-size:36px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.02em;"><font color="#ffffff">Welcome to the family</font></h1>
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

            <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.75;">
              Thank you for subscribing! Here&rsquo;s your personal welcome coupon &mdash; enter it at checkout for a discount on your first order.
            </p>

            <!-- Coupon box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;margin-bottom:32px;">
              <tr>
                <td style="padding:28px 32px;text-align:center;">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#059669;">Your Welcome Coupon</p>
                  <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:40px;font-weight:800;color:#065f46;letter-spacing:0.22em;">${couponCode}</p>
                  <p style="margin:10px 0 20px;font-size:12px;color:#6b7280;">Valid until ${expiryStr} &middot; First order only</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #bbf7d0;max-width:360px;margin:0 auto;">
                    <tr>
                      <td style="padding:12px 0 6px;font-size:14px;color:#374151;" align="left">Order $150 or more</td>
                      <td style="padding:12px 0 6px;font-size:14px;font-weight:700;color:#065f46;" align="right">$20 off</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0 0;font-size:14px;color:#374151;" align="left">Order under $150</td>
                      <td style="padding:6px 0 0;font-size:14px;font-weight:700;color:#065f46;" align="right">$10 off</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                    Browse Our Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.65;">
              Valid on your first order only. Enter code <strong style="color:#374151;">${couponCode}</strong> at checkout. Cannot be combined with other offers.
            </p>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:20px 64px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
              &ensp;&middot;&ensp;<a href="${siteUrl}/rewards" style="color:#9ca3af;text-decoration:none;">Client Rewards</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#d1d5db;">
              <a href="${unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">unsubscribe</a>
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

/**
 * Sent immediately when someone subscribes to the newsletter.
 * Shows their unique 6-digit welcome coupon code.
 */
export async function sendWelcomeSubscriberEmail(
  email: string,
  couponCode: string,
  expiresAt: Date
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const from =
    process.env.RESEND_FROM_EMAIL_GENERIC ??
    "BingBing Jade <hello@bingbingjade.com>";
  const html = buildWelcomeCouponHtml({
    email,
    couponCode,
    expiresAt,
    siteUrl
  });

  try {
    await resend.emails.send({
      from,
      to: email,
      bcc: "contact@bingbingjade.com",
      subject: `Your BingBing Jade welcome coupon: ${couponCode}`,
      html
    });
  } catch (err) {
    console.error("[discount-emails] Failed to send welcome email:", err);
  }
}

/**
 * Admin resend: re-send the welcome coupon email to a specific subscriber.
 * Uses the same template as the initial welcome email.
 */
export async function resendSubscriberCouponEmail(
  email: string,
  couponCode: string,
  expiresAt: Date
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const from =
    process.env.RESEND_FROM_EMAIL_GENERIC ??
    "BingBing Jade <hello@bingbingjade.com>";
  const html = buildWelcomeCouponHtml({
    email,
    couponCode,
    expiresAt,
    siteUrl
  });

  try {
    await resend.emails.send({
      from,
      to: email,
      bcc: "contact@bingbingjade.com",
      subject: `Your BingBing Jade welcome coupon: ${couponCode}`,
      html
    });
  } catch (err) {
    console.error("[discount-emails] Failed to resend coupon email:", err);
    throw err;
  }
}

export type BulkSubscriber = { email: string; unsubscribeToken?: string };

/**
 * Admin bulk broadcast: send a campaign/promo email to a list of subscribers.
 * Renders HTML per-recipient so each unsubscribe link is personalized.
 *
 * - `renderHtml(unsubscribeUrl)` is called once per subscriber.
 * - If a subscriber has no `unsubscribeToken`, falls back to a base64-encoded
 *   email param (`?e=…`) for backward compatibility.
 * - Batches in groups of 50 to stay within Resend limits.
 */
export async function sendBulkSubscriberEmail(params: {
  subscribers: BulkSubscriber[];
  subject: string;
  renderHtml: (unsubscribeUrl: string) => string;
  siteUrl: string;
}): Promise<{ sent: number; failed: number }> {
  const resend = getResend();
  if (!resend) return { sent: 0, failed: params.subscribers.length };

  const from =
    process.env.RESEND_FROM_EMAIL_GENERIC ??
    "BingBing Jade <hello@bingbingjade.com>";
  const BATCH_SIZE = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < params.subscribers.length; i += BATCH_SIZE) {
    const chunk = params.subscribers.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(
        chunk.map(({ email, unsubscribeToken }) => {
          const unsubscribeUrl = unsubscribeToken
            ? `${params.siteUrl}/api/unsubscribe?token=${unsubscribeToken}`
            : `${params.siteUrl}/api/unsubscribe?e=${Buffer.from(email).toString("base64")}`;
          return {
            from,
            to: email,
            subject: params.subject,
            html: params.renderHtml(unsubscribeUrl),
          };
        })
      );
      sent += chunk.length;
    } catch (err) {
      console.error(
        `[discount-emails] Bulk send batch ${i / BATCH_SIZE} failed:`,
        err
      );
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

/** Build a branded HTML wrapper for admin broadcast emails. */
export function buildBroadcastHtml(params: {
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
}): string {
  const siteUrl = getSiteUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            ${params.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
              &ensp;&middot;&ensp;<a href="${siteUrl}/rewards" style="color:#9ca3af;text-decoration:none;">Client Rewards</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#d1d5db;">
              <a href="${params.unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a>
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

// ── Customer coupon email (admin-issued) ─────────────────────────────────────

export function buildCustomerCouponHtml(params: {
  couponCode: string;
  purpose: "thank_you" | "retention";
  discountLabel: string;
  expiresAt?: Date | null;
}): string {
  const siteUrl = getSiteUrl();
  const { couponCode, purpose, discountLabel, expiresAt } = params;

  const isThankYou = purpose === "thank_you";
  const eyebrow = isThankYou
    ? "BingBing Jade &nbsp;·&nbsp; Thank You"
    : "BingBing Jade &nbsp;·&nbsp; We Miss You";
  const headline = isThankYou
    ? "A little gift,<br>just for you"
    : "It&rsquo;s been a while &mdash;<br>here&rsquo;s something special";
  const bodyText = isThankYou
    ? `Thank you so much for your order &mdash; it means the world to us. As a small token of our appreciation, we&rsquo;ve put together a personal discount, just for you. We hope to see you again soon!`
    : `We noticed it&rsquo;s been a while since your last visit, and we&rsquo;ve been thinking of you. Here&rsquo;s a personal discount code to welcome you back &mdash; we&rsquo;d love to have you shop with us again.`;
  const expiryStr = expiresAt
    ? expiresAt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    : null;

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
    @media only screen and (max-width:640px) { .email-body { padding: 36px 28px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:900px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:900px;height:300px;">
              <v:fill type="frame" src="${JADE_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${JADE_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:300px;">
                <tr>
                  <td height="300" style="background:linear-gradient(135deg,rgba(2,44,34,0.85) 0%,rgba(6,95,70,0.75) 60%,rgba(0,0,0,0.45) 100%);padding:60px 72px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">${eyebrow}</font></p>
                    <h1 class="banner-heading" style="margin:0;font-size:42px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.02em;"><font color="#ffffff">${headline}</font></h1>
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
          <td class="email-body" style="padding:52px 72px 48px;">

            <p style="margin:0 0 32px;font-size:16px;color:#374151;line-height:1.8;">${bodyText}</p>

            <!-- Coupon box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;margin-bottom:36px;">
              <tr>
                <td style="padding:36px 40px;text-align:center;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#059669;">Your Personal Coupon</p>
                  <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:800;color:#065f46;letter-spacing:0.22em;">${couponCode}</p>
                  <p style="margin:14px 0 0;font-size:17px;font-weight:700;color:#065f46;">${discountLabel}</p>
                  ${expiryStr ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Valid until ${expiryStr}</p>` : ""}
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:15px 40px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                    Browse Our Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.65;">
              Enter code <strong style="color:#374151;">${couponCode}</strong> at checkout. This coupon is personal and cannot be shared.
            </p>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:20px 72px 32px;border-top:1px solid #f3f4f6;text-align:center;">
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
}

/**
 * Sent by admin when issuing a personal coupon to a specific customer.
 * Purpose: "thank_you" (Thank You Note) or "retention" (We Miss You).
 */
export async function sendCustomerCouponEmail(params: {
  customerEmail: string;
  couponCode: string;
  purpose: "thank_you" | "retention";
  discountLabel: string;
  expiresAt?: Date | null;
  scheduledAt?: string | null;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const {
    customerEmail,
    couponCode,
    purpose,
    discountLabel,
    expiresAt,
    scheduledAt
  } = params;
  const isThankYou = purpose === "thank_you";
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const html = buildCustomerCouponHtml({
    couponCode,
    purpose,
    discountLabel,
    expiresAt
  });

  try {
    await resend.emails.send({
      from,
      to: customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: isThankYou
        ? `A thank-you gift from BingBing Jade: ${couponCode}`
        : `We miss you — here's ${discountLabel} on us: ${couponCode}`,
      html,
      ...(scheduledAt ? { scheduledAt } : {})
    });
  } catch (err) {
    console.error(
      "[discount-emails] Failed to send customer coupon email:",
      err
    );
    throw err;
  }
}

// ── Customer coupon reminder email ───────────────────────────────────────────

export function buildCustomerCouponReminderHtml(params: {
  couponCode: string;
  discountLabel: string;
  expiresAt: Date;
  reminderNumber: 1 | 2;
}): string {
  const siteUrl = getSiteUrl();
  const { couponCode, discountLabel, expiresAt, reminderNumber } = params;
  const expiryStr = expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const isLast = reminderNumber === 2;
  const eyebrowText = isLast
    ? "BingBing Jade &nbsp;·&nbsp; Last Chance"
    : "BingBing Jade &nbsp;·&nbsp; Just a Reminder";
  const eyebrowColor = isLast ? "#fde68a" : "#6ee7b7";
  const overlayGradient = isLast
    ? "linear-gradient(135deg,rgba(69,26,3,0.88) 0%,rgba(120,53,15,0.78) 60%,rgba(0,0,0,0.48) 100%)"
    : "linear-gradient(135deg,rgba(2,44,34,0.85) 0%,rgba(6,95,70,0.75) 60%,rgba(0,0,0,0.45) 100%)";
  const headline = isLast
    ? "Your coupon<br>expires soon"
    : "Your coupon is<br>still waiting for you";
  const bodyText = isLast
    ? `Your personal discount code expires on <strong>${expiryStr}</strong> &mdash; just one month away. Don&rsquo;t let it go to waste! Browse our collection and use it before it expires.`
    : `We sent you a personal discount a little while ago, and we noticed you haven&rsquo;t had a chance to use it yet. It&rsquo;s still valid and waiting for you &mdash; we&rsquo;d love to have you back.`;
  const boxBg = isLast ? "#fffbeb" : "#f0fdf4";
  const boxBorder = isLast ? "#fde68a" : "#bbf7d0";
  const boxEyebrowColor = isLast ? "#b45309" : "#059669";
  const boxCodeColor = isLast ? "#92400e" : "#065f46";
  const ctaBg = isLast ? "#92400e" : "#065f46";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }
    .banner-eyebrow { color: ${eyebrowColor} !important; -webkit-text-fill-color: ${eyebrowColor} !important; }
    .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    [data-ogsc] .banner-eyebrow, [data-ogsb] .banner-eyebrow { color: ${eyebrowColor} !important; -webkit-text-fill-color: ${eyebrowColor} !important; }
    [data-ogsc] .banner-heading, [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    @media only screen and (max-width:640px) { .email-body { padding: 36px 28px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:900px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:900px;height:300px;">
              <v:fill type="frame" src="${JADE_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${JADE_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:300px;">
                <tr>
                  <td height="300" style="background:${overlayGradient};padding:60px 72px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:${eyebrowColor}!important;-webkit-text-fill-color:${eyebrowColor}!important;"><font color="${eyebrowColor}">${eyebrowText}</font></p>
                    <h1 class="banner-heading" style="margin:0;font-size:42px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.02em;"><font color="#ffffff">${headline}</font></h1>
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
          <td class="email-body" style="padding:52px 72px 48px;">

            <p style="margin:0 0 32px;font-size:16px;color:#374151;line-height:1.8;">${bodyText}</p>

            <!-- Coupon box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${boxBg};border:2px solid ${boxBorder};border-radius:12px;margin-bottom:36px;">
              <tr>
                <td style="padding:36px 40px;text-align:center;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${boxEyebrowColor};">Your Personal Coupon</p>
                  <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:800;color:${boxCodeColor};letter-spacing:0.22em;">${couponCode}</p>
                  <p style="margin:14px 0 0;font-size:17px;font-weight:700;color:${boxCodeColor};">${discountLabel}</p>
                  <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Expires ${expiryStr}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
              <tr>
                <td style="background:${ctaBg};border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:15px 40px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
                    Browse Our Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.65;">
              Enter code <strong style="color:#374151;">${couponCode}</strong> at checkout. This coupon is personal and cannot be shared.
            </p>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:20px 72px 32px;border-top:1px solid #f3f4f6;text-align:center;">
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
}

/**
 * Sent 1 month and 2 months after the original coupon email if still unredeemed.
 * reminderNumber: 1 = "still waiting", 2 = "last chance"
 */
export async function sendCustomerCouponReminderEmail(params: {
  customerEmail: string;
  couponCode: string;
  discountLabel: string;
  expiresAt: Date;
  reminderNumber: 1 | 2;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const from = "BingBing Jade <notification@bingbingjade.com>";
  const {
    customerEmail,
    couponCode,
    discountLabel,
    expiresAt,
    reminderNumber
  } = params;
  const isLast = reminderNumber === 2;
  const subject = isLast
    ? `Last chance — your BingBing Jade coupon expires soon`
    : `Your BingBing Jade coupon is still valid`;
  const html = buildCustomerCouponReminderHtml({
    couponCode,
    discountLabel,
    expiresAt,
    reminderNumber
  });

  try {
    await resend.emails.send({
      from,
      to: customerEmail,
      bcc: "contact@bingbingjade.com",
      subject,
      html
    });
  } catch (err) {
    console.error(
      "[discount-emails] Failed to send coupon reminder email:",
      err
    );
    throw err;
  }
}

// ── Referral invite email ─────────────────────────────────────────────────────

/**
 * Sent to a customer after their FIRST order is delivered.
 * Gives them their referral code and explains how the program works.
 */
export async function sendReferralInviteEmail(params: {
  customerName: string;
  customerEmail: string;
  referralCode: string;
  orderNumber: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const firstName = params.customerName.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Client Rewards</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Your order has been delivered — we hope your piece stays with you for years to come. 💚 Most of our clients come through word of mouth — from people who care about getting it right.
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              As part of BingBing Jade, you now have a personal referral code to share with someone discovering jade for the first time. When they place their first order with your code, they’ll receive a private welcome offer of <strong>$20 off</strong>, and you’ll receive a credit toward your next piece once their order is successfully delivered.
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Your reward reflects the piece they choose:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#059669;">Your Referral Code</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#065f46;letter-spacing:0.12em;">${params.referralCode}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">Your code stays with you and can be shared anytime</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
                  Referred order under <strong>$500</strong> → you receive <strong style="color:#065f46;">$10 in credits</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
                  Referred order from <strong>$500 to $999</strong> → you receive <strong style="color:#065f46;">$20 in credits</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
                  Referred order from <strong>$1000 to $1999</strong> → you receive <strong style="color:#065f46;">$30 in credits</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;font-size:14px;color:#374151;">
                  Referred order of <strong>$2000+</strong> → you receive <strong style="color:#065f46;">$50 in credits</strong>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">1.</td>
                    <td style="font-size:14px;color:#374151;">Share your code with someone new to BingBing Jade</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">2.</td>
                    <td style="font-size:14px;color:#374151;">They use <strong>your code</strong> on their first order and receive <strong>$20 off</strong></td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">3.</td>
                    <td style="font-size:14px;color:#374151;">Once their order is delivered, your credit is issued based on the piece they chose</td>
                  </tr></table>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/rewards" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    View Client Rewards &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 14px;font-size:13px;color:#6b7280;line-height:1.6;">
              Jade has always been something meant to be shared — with people you care about.
            </p>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              Referral welcome offer is reserved for first-time customers and cannot be combined with other discounts. Client credit is issued after the referred order is successfully delivered.
            </p>
          </td>
        </tr>

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
    await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `[You've Been Invited] Your BingBing Jade referral code — share and earn up to $50 in credits`,
      html
    });
  } catch (err) {
    console.error(
      "[discount-emails] Failed to send referral invite email:",
      err
    );
  }
}

// ── Referral reward email ─────────────────────────────────────────────────────

/**
 * Sent to the referrer when they earn tiered store credit based on the referred order amount.
 */
export async function sendReferralRewardEmail(params: {
  referrerName: string;
  referrerEmail: string;
  creditAmountDollars: number;
  newCreditBalance: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const from = "BingBing Jade <notification@bingbingjade.com>";
  const firstName = params.referrerName.split(" ")[0];

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
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Client Rewards</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Someone you invited has just completed their order — thank you for sharing BingBing Jade with them. 💚
            </p>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Your referral credit has now been issued:
            </p>

            <!-- Reward Highlight -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#059669;">
                    Credit Earned
                  </p>
                  <p style="margin:0;font-size:34px;font-weight:800;color:#065f46;">
                    $${params.creditAmountDollars}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              This credit has been added to your account and can be applied toward your next piece anytime.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/rewards" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    View My Rewards &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Soft reinforcement -->
            <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">
              Your referral code is always available to share — and your rewards grow based on the pieces they choose.
            </p>

            <p style="margin:0 0 14px;font-size:13px;color:#6b7280;line-height:1.6;">
              Jade has always been something you share — with people you care about.
            </p>

            <!-- Footer note -->
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
              Referral rewards are issued after successful orders and may not be combined with other offers.
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
    await resend.emails.send({
      from,
      to: params.referrerEmail,
      bcc: "contact@bingbingjade.com",
      subject: `[Order Update] You earned $${params.creditAmountDollars.toFixed(2)} store credit — BingBing Jade`,
      html
    });
  } catch (err) {
    console.error(
      "[discount-emails] Failed to send referral reward email:",
      err
    );
  }
}
