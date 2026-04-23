import { Resend } from "resend";

function getResend() {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
}

/**
 * Send a magic-link email for the /rewards lookup page.
 * Always returns a generic message to the caller regardless of whether
 * the email matched a customer — to avoid email enumeration.
 */
export async function sendRewardsMagicLinkEmail(params: {
  toEmail: string;
  token: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = getSiteUrl();
  const link = `${siteUrl}/rewards?token=${encodeURIComponent(params.token)}`;
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <tr>
          <td style="background:#065f46;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Private Client Access</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
              We received a request to view your rewards. Use the link below to access your private client benefits — it expires in <strong>15 minutes</strong>.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${link}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    View My Rewards &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">
              If you didn&rsquo;t request this, you can safely ignore this email. No changes have been made to your account.
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Link expires in 15 minutes &middot; Do not share this link
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.8;">
              &copy; ${year} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: "BingBing Jade <notification@bingbingjade.com>",
    to: params.toEmail,
    bcc: "contact@bingbingjade.com",
    subject: "Your secure rewards link — BingBing Jade",
    html,
  });
}
