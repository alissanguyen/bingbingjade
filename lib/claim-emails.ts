// lib/claim-emails.ts
//
// Customer notification for claims (§29). Reuses the exact Resend setup
// lib/orders.ts already uses (same env vars, same from-address, same
// minimal-HTML style) rather than introducing a second email client.
// Every send — successful or not — is logged to claim_communications so
// there's a durable record of what the customer was told and when.

import { Resend } from "resend";
import { supabaseAdmin } from "./supabase-admin";

export async function notifyCustomer(params: {
  claimId: string;
  templateKey: string;
  subject: string;
  body: string; // plain-language, customer-safe text — never internal notes
  createdBy: string;
}): Promise<void> {
  const { data: claim } = await supabaseAdmin
    .from("claims")
    .select("claim_number, customer_email, orders(order_number)")
    .eq("id", params.claimId)
    .maybeSingle();

  const recipient = claim?.customer_email ?? null;
  const apiKey = process.env.RESEND_API_KEY;

  if (!recipient) {
    await logCommunication(params, null, "failed", "no customer email on claim");
    return;
  }
  if (!apiKey) {
    console.info("[claim-emails] Resend not configured — skipping send, logging as skipped");
    await logCommunication(params, recipient, "skipped", "RESEND_API_KEY not configured");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL_ORDER_CONFIRMATION ?? "BingBing Jade <orders@bingbingjade.com>";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
  const orderNumber = (claim?.orders as unknown as { order_number: string } | null)?.order_number;
  const trackUrl = orderNumber ? `${siteUrl}/orders/${orderNumber}` : siteUrl;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr><td style="background:#065f46;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">Claim ${claim?.claim_number ?? ""}</p>
          <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111827;">${escapeHtml(params.body)}</p>
          <a href="${trackUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#065f46;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View your claim</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to: recipient, subject: params.subject, html });
    await logCommunication(params, recipient, "sent", null);
  } catch (err) {
    console.error("[claim-emails] send failed:", err);
    await logCommunication(params, recipient, "failed", err instanceof Error ? err.message : "unknown error");
  }
}

async function logCommunication(
  params: { claimId: string; templateKey: string; subject: string; createdBy: string },
  recipient: string | null,
  status: "sent" | "failed" | "skipped",
  failureReason: string | null
) {
  await supabaseAdmin.from("claim_communications").insert({
    claim_id: params.claimId,
    channel: "email",
    recipient: recipient ?? "unknown",
    template_key: params.templateKey,
    subject: params.subject,
    sent_status: status,
    failure_reason: failureReason,
    created_by: params.createdBy,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
}
