import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildProductShowcaseHtml, type EmailProduct } from "@/lib/product-email";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: { subject?: string; intro?: string; productIds?: string[]; targetEmails?: string[] | null };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  if (!subject) return NextResponse.json({ error: "subject is required." }, { status: 400 });
  if (!body.productIds?.length) return NextResponse.json({ error: "Select at least one product." }, { status: 400 });

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, category, slug, public_id, price_display_usd, sale_price_usd, status, images")
    .in("id", body.productIds);

  if (!products?.length) return NextResponse.json({ error: "No products found." }, { status: 404 });

  const ordered = body.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as typeof products;

  const emailProducts: EmailProduct[] = await Promise.all(
    ordered.map(async (p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      slug: productSlug(p),
      price_display_usd: p.price_display_usd,
      sale_price_usd: p.sale_price_usd,
      status: p.status,
      imageUrl: await resolveFirstImageUrl(p.images ?? []),
    }))
  );

  const html = buildProductShowcaseHtml({
    subject,
    intro: body.intro?.trim() ?? "",
    products: emailProducts,
    unsubscribeUrl: `${SITE_URL}/api/unsubscribe`,
    siteUrl: SITE_URL,
  });

  if (preview) return NextResponse.json({ html });

  // Determine recipients
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
