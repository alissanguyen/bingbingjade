import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildCustomerCouponReminderHtml } from "@/lib/discount-emails";
import { Resend } from "resend";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const BATCH_SIZE = 50;

// POST /api/admin/subscribers/bulk-resend
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { ids?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ids = body.ids ?? [];
  if (ids.length === 0) return NextResponse.json({ error: "No subscriber IDs provided." }, { status: 400 });

  const { data: subs, error } = await supabaseAdmin
    .from("email_subscribers")
    .select("id, email, welcome_coupon_code, welcome_coupon_expires_at, welcome_discount_redeemed_at")
    .in("id", ids)
    .is("unsubscribed_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only resend to those with a coupon that hasn't been redeemed
  const eligible = (subs ?? []).filter(
    (s) => s.welcome_coupon_code && !s.welcome_discount_redeemed_at
  );

  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Email service not configured." }, { status: 500 });

  const resend = new Resend(key);
  const rawFrom = process.env.RESEND_FROM_EMAIL_GENERIC ?? "hello@bingbingjade.com";
  const from = rawFrom.includes("<") ? rawFrom : `BingBing Jade <${rawFrom}>`;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const chunk = eligible.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(
        chunk.map((s) => {
          const expiresAt = s.welcome_coupon_expires_at
            ? new Date(s.welcome_coupon_expires_at)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const html = buildCustomerCouponReminderHtml({
            couponCode: s.welcome_coupon_code,
            discountLabel: "Up to $20 off your first order",
            expiresAt,
            reminderNumber: 2,
          });
          return {
            from,
            to: s.email,
            bcc: "contact@bingbingjade.com",
            subject: "Last chance — your BingBing Jade coupon expires soon",
            html,
          };
        })
      );
      sent += chunk.length;
    } catch (err) {
      console.error(`[bulk-resend] Batch ${i / BATCH_SIZE} failed:`, err);
      failed += chunk.length;
    }
  }

  void SITE_URL;
  return NextResponse.json({ sent, failed, total: eligible.length });
}
