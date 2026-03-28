import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/unsubscribe?e=<base64-encoded-email>
 *
 * Removes the subscriber from the email_subscribers table.
 * URL is only included in outbound emails, so possession of the link
 * is sufficient authorization — no additional token needed.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("e");

  let email: string | null = null;
  try {
    if (raw) email = atob(raw).trim().toLowerCase();
  } catch {
    // malformed base64
  }

  if (!email || !email.includes("@")) {
    return new NextResponse(unsubscribePage("Invalid unsubscribe link.", false), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  await supabaseAdmin.from("email_subscribers").delete().eq("email", email);
  // Non-fatal — if the email wasn't in the list, the delete is a no-op.

  return new NextResponse(unsubscribePage(email, true), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function unsubscribePage(emailOrMsg: string, success: boolean): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const heading = success ? "You've been unsubscribed." : "Something went wrong.";
  const body = success
    ? `<strong>${emailOrMsg}</strong> has been removed from our mailing list. You will no longer receive promotional emails from BingBing Jade.`
    : emailOrMsg;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — BingBing Jade</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;min-height:100vh;">
    <tr><td align="center" style="padding:60px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#065f46;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;text-align:center;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${heading}</h2>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">${body}</p>
            <a href="${siteUrl}" style="display:inline-block;background:#065f46;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:999px;font-size:14px;font-weight:600;">
              Return to Shop
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
