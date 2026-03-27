/**
 * Discount & referral email functions.
 * All use Resend, matching the style of existing order emails in lib/orders.ts.
 */

import { Resend } from "resend";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

// ── Welcome subscriber email ─────────────────────────────────────────────────

/**
 * Sent immediately when someone subscribes to the newsletter.
 * Explains the tiered first-order discount.
 */
export async function sendWelcomeSubscriberEmail(email: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const from = process.env.RESEND_FROM_EMAIL ?? "BingBing Jade <orders@bingbingjade.com>";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Welcome</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Welcome to the BingBing Jade family!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for subscribing. As a welcome gift, your first order comes with a special discount — automatically applied when you check out with this email address.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#059669;">Your Welcome Discount</p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#374151;">Order $150 or more</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#065f46;text-align:right;">$20 off</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#374151;">Order under $150</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#065f46;text-align:right;">$10 off</td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">
                    Just enter your email in the cart before checking out. No code needed — the discount is applied automatically.
                  </p>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Browse Our Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              Valid on your first order only. Cannot be combined with other offers. Discount is applied at checkout based on your order total.
            </p>
          </td>
        </tr>

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
    await resend.emails.send({
      from,
      to: email,
      bcc: "bingbing.jade2@gmail.com",
      subject: "Welcome to BingBing Jade — Here's your first-order discount",
      html,
    });
  } catch (err) {
    console.error("[discount-emails] Failed to send welcome email:", err);
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
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Referral Program</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Your order has been delivered — we hope your piece brings you lasting joy! 💚
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              As a thank you for being part of our community, you now have a personal referral code. Share it with friends who are new to BingBing Jade — they get a discount on their first order, and you earn <strong>$10 store credit</strong> when their order is delivered.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#059669;">Your Referral Code</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#065f46;letter-spacing:0.12em;">${params.referralCode}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">Friends enter this code in the cart before checking out</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">1.</td>
                    <td style="font-size:14px;color:#374151;">Share your code with a friend who hasn't shopped with us</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">2.</td>
                    <td style="font-size:14px;color:#374151;">They enter <strong>${params.referralCode}</strong> in the cart — they save $10&ndash;$20 on their first order</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="font-size:13px;color:#6b7280;width:20px;padding-right:10px;">3.</td>
                    <td style="font-size:14px;color:#374151;">Once their order is delivered, you earn <strong style="color:#065f46;">$10 store credit</strong></td>
                  </tr></table>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Browse Our Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              Referral discount is for first-time customers only. Store credit is issued after the referred order is delivered. Cannot be combined with other discounts.
            </p>
          </td>
        </tr>

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
    await resend.emails.send({
      from,
      to: params.customerEmail,
      bcc: "bingbing.jade2@gmail.com",
      subject: `Your BingBing Jade referral code — share and earn $10`,
      html,
    });
  } catch (err) {
    console.error("[discount-emails] Failed to send referral invite email:", err);
  }
}

// ── Referral reward email ─────────────────────────────────────────────────────

/**
 * Sent to the referrer when they earn $10 store credit.
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

        <tr>
          <td style="background:#065f46;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Referral Reward</p>
            <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Great news! Someone you referred has received their order. Your referral reward has been added to your account.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#374151;">Reward earned</td>
                      <td style="padding:6px 0;font-size:16px;font-weight:700;color:#065f46;text-align:right;">+$${params.creditAmountDollars.toFixed(2)} store credit</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#374151;">New credit balance</td>
                      <td style="padding:6px 0;font-size:14px;font-weight:600;color:#374151;text-align:right;">$${params.newCreditBalance.toFixed(2)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Your store credit will be automatically applied to your next order. Keep sharing your referral code to earn more!
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Shop Now &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              Questions? Reach out via <a href="${siteUrl}/contact" style="color:#059669;text-decoration:none;">our contact page</a>.
            </p>
          </td>
        </tr>

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
    await resend.emails.send({
      from,
      to: params.referrerEmail,
      bcc: "bingbing.jade2@gmail.com",
      subject: `You earned $${params.creditAmountDollars.toFixed(2)} store credit — BingBing Jade`,
      html,
    });
  } catch (err) {
    console.error("[discount-emails] Failed to send referral reward email:", err);
  }
}
