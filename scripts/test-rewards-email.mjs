/**
 * One-time test script: inserts a rewards token and sends the magic-link email.
 * Run with: node scripts/test-rewards-email.mjs
 */
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL = "https://cszryoixzqtzikvgeksh.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzenJ5b2l4enF0emlrdmdla3NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ0MDkzNiwiZXhwIjoyMDg5MDE2OTM2fQ.rQrmNSstYSaEj4F4HpJrT_jZ2lOvglOUR3nlb5-Qi3Q";
const RESEND_API_KEY = "re_54dS35mS_82X1Dt65MieJYvDWdtmXPkDB";
const SITE_URL = "https://www.bingbingjade.com";
const TEST_EMAIL = "im.tamnguyen@gmail.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const resend = new Resend(RESEND_API_KEY);

// Generate token
const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour for testing
const link = `${SITE_URL}/rewards?token=${encodeURIComponent(token)}`;

// Insert token
const { error } = await supabase.from("rewards_tokens").insert({
  email: TEST_EMAIL,
  token_hash: tokenHash,
  expires_at: expiresAt,
});

if (error) {
  console.error("❌ Failed to insert token:", error.message);
  console.log("\nHave you run migration_053.sql in Supabase? If not, run it first.");
  process.exit(1);
}

console.log("✅ Token inserted (expires in 1 hour for testing)");
console.log("\n🔗 Test link:\n", link, "\n");

// Send email
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
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">REWARDS CENTER</p>
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
              <a href="${SITE_URL}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const { error: emailError } = await resend.emails.send({
  from: "BingBing Jade <notification@bingbingjade.com>",
  to: TEST_EMAIL,
  bcc: "contact@bingbingjade.com",
  subject: "Your secure rewards link — BingBing Jade",
  html,
});

if (emailError) {
  console.error("❌ Failed to send email:", emailError);
} else {
  console.log(`✅ Email sent to ${TEST_EMAIL}`);
  console.log("\nNote: the link uses 1-hour expiry (instead of 15 min) so you have time to review the page.");
}
