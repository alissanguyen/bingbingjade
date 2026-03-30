import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBulkSubscriberEmail, buildBroadcastHtml } from "@/lib/discount-emails";

// POST /api/admin/subscribers/bulk-email
// Body: { subject, message, target: "all" | "unused" }
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subject?: string; message?: string; target?: "all" | "unused" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const message = body.message?.trim();
  if (!subject) return NextResponse.json({ error: "subject is required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  const target = body.target ?? "all";

  let query = supabaseAdmin.from("email_subscribers").select("email");
  if (target === "unused") {
    query = query.is("welcome_discount_redeemed_at", null);
  }

  const { data: subscribers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const emails = (subscribers ?? []).map((s) => s.email);
  if (emails.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  // Build branded HTML from the admin's message
  const bodyHtml = message
    .split("\n\n")
    .filter(Boolean)
    .map((para) => `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = buildBroadcastHtml({ subject, bodyHtml, emails });

  const { sent, failed } = await sendBulkSubscriberEmail({ emails, subject, html });

  return NextResponse.json({ sent, failed, total: emails.length });
}
