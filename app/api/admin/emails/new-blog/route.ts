import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildBlogAnnouncementHtml } from "@/lib/email-templates";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: {
    subject?: string;
    postTitle?: string;
    postExcerpt?: string;
    postImageUrl?: string;
    postSlug?: string;
    targetEmails?: string[] | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  if (!subject) return NextResponse.json({ error: "subject is required." }, { status: 400 });
  if (!body.postSlug) return NextResponse.json({ error: "Post is required." }, { status: 400 });

  const postUrl = `${SITE_URL}/blog/${body.postSlug}`;
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe`;

  const html = buildBlogAnnouncementHtml({
    subject,
    postTitle: body.postTitle ?? subject,
    postExcerpt: body.postExcerpt,
    postImageUrl: body.postImageUrl,
    postUrl,
    unsubscribeUrl,
  });

  if (preview) return NextResponse.json({ html });

  let emails: string[];
  if (body.targetEmails && body.targetEmails.length > 0) {
    emails = body.targetEmails;
  } else {
    const { data: subs } = await supabaseAdmin.from("email_subscribers").select("email");
    emails = (subs ?? []).map((s) => s.email);
  }

  if (emails.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  const { sent, failed } = await sendBulkSubscriberEmail({ emails, subject, html });
  return NextResponse.json({ sent, failed, total: emails.length });
}
