import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { buildOrderDelayHtml } from "@/lib/email-templates";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: { orderIds?: string[]; customMessage?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.orderIds?.length) return NextResponse.json({ error: "Select at least one order." }, { status: 400 });

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, customer_name, customer_email, order_number")
    .in("id", body.orderIds);

  if (!orders?.length) return NextResponse.json({ error: "No orders found." }, { status: 404 });

  // Preview uses the first order as sample
  if (preview) {
    const first = orders[0];
    const html = buildOrderDelayHtml({ customerName: first.customer_name, orderNumber: first.order_number, customMessage: body.customMessage });
    return NextResponse.json({ html });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return NextResponse.json({ error: "Email not configured." }, { status: 500 });

  const from = process.env.RESEND_FROM_EMAIL_GENERIC ?? "BingBing Jade <hello@bingbingjade.com>";
  const subject = "An update on your BingBing Jade order";

  let sent = 0;
  let failed = 0;

  // Deduplicate by email
  const seen = new Set<string>();
  const recipients = orders.filter((o) => {
    if (!o.customer_email || seen.has(o.customer_email)) return false;
    seen.add(o.customer_email);
    return true;
  });

  // Batch in groups of 50
  const BATCH = 50;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);
    try {
      await resend.batch.send(
        chunk.map((o) => ({
          from,
          to: o.customer_email!,
          subject,
          html: buildOrderDelayHtml({ customerName: o.customer_name, orderNumber: o.order_number, customMessage: body.customMessage }),
        }))
      );
      sent += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}
