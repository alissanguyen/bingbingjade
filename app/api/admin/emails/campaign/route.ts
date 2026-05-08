import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildCampaignEmailHtml } from "@/lib/campaign-email";
import type { EmailProduct } from "@/lib/product-email";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: {
    subject?: string;
    headline?: string;
    intro?: string;
    urgencyLine?: string;
    ctaText?: string;
    ctaLink?: string;
    discountType?: "fixed" | "percentage";
    discountValue?: number;
    discountCode?: string;
    expiryDate?: string;
    productIds?: string[];
    targetEmails?: string[] | null;
  };

  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const headline = body.headline?.trim();
  const intro = body.intro?.trim();
  const ctaText = body.ctaText?.trim();
  const ctaLink = body.ctaLink?.trim();

  if (!subject)   return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!headline)  return NextResponse.json({ error: "Headline is required." }, { status: 400 });
  if (!intro)     return NextResponse.json({ error: "Intro is required." }, { status: 400 });
  if (!ctaText)   return NextResponse.json({ error: "CTA text is required." }, { status: 400 });
  if (!ctaLink)   return NextResponse.json({ error: "CTA link is required." }, { status: 400 });

  // Resolve products (optional)
  let products: EmailProduct[] = [];
  if (body.productIds && body.productIds.length > 0) {
    const { data: raw } = await supabaseAdmin
      .from("products")
      .select("id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images")
      .in("id", body.productIds);

    if (raw && raw.length > 0) {
      const ordered = body.productIds
        .map((id) => raw.find((p) => p.id === id))
        .filter(Boolean) as typeof raw;

      products = await Promise.all(
        ordered.map(async (p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          slug: productSlug(p),
          show_price: p.show_price ?? false,
          price_display_usd: p.price_display_usd,
          sale_price_usd: p.sale_price_usd,
          status: p.status,
          imageUrl: await resolveFirstImageUrl(p.images ?? []),
        }))
      );
    }
  }

  const renderHtml = (unsubscribeUrl: string) =>
    buildCampaignEmailHtml({
      subject: subject!,
      headline: headline!,
      intro: intro!,
      urgencyLine: body.urgencyLine?.trim() || undefined,
      ctaText: ctaText!,
      ctaLink: ctaLink!,
      discountType: body.discountType,
      discountValue: body.discountValue,
      discountCode: body.discountCode?.trim() || undefined,
      expiryDate: body.expiryDate?.trim() || undefined,
      products: products.length > 0 ? products : undefined,
      unsubscribeUrl,
      siteUrl: SITE_URL,
    });

  if (preview) {
    return NextResponse.json({ html: renderHtml(`${SITE_URL}/api/unsubscribe?token=preview`) });
  }

  // Determine recipients
  let subscribers: { email: string; unsubscribeToken?: string }[];
  if (body.targetEmails && body.targetEmails.length > 0) {
    subscribers = body.targetEmails.map((email) => ({ email }));
  } else {
    const { data: subs } = await supabaseAdmin
      .from("email_subscribers")
      .select("email, unsubscribe_token")
      .is("unsubscribed_at", null);
    subscribers = (subs ?? []).map((s) => ({ email: s.email, unsubscribeToken: s.unsubscribe_token }));
  }

  if (subscribers.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0, couponCreated: false });

  const { sent, failed } = await sendBulkSubscriberEmail({
    subscribers,
    subject: subject!,
    renderHtml,
    siteUrl: SITE_URL,
  });

  // Auto-create coupon if a discount code was included.
  // Uses ignoreDuplicates so an existing coupon with the same code is never overwritten.
  let couponCreated = false;
  const couponCode = body.discountCode?.trim().toUpperCase();
  if (couponCode && body.discountType && body.discountValue && body.discountValue > 0) {
    const dbDiscountType = body.discountType === "percentage" ? "percent" : "fixed";

    let endsAt: string | null = null;
    if (body.expiryDate) {
      const parsed = new Date(body.expiryDate);
      if (!isNaN(parsed.getTime())) endsAt = parsed.toISOString();
    }

    const { error: couponError } = await supabaseAdmin
      .from("coupon_campaigns")
      .upsert(
        {
          code: couponCode,
          name: `Campaign: ${subject}`,
          discount_type: dbDiscountType,
          discount_value: body.discountValue,
          active: true,
          ends_at: endsAt,
          max_redemptions_per_customer: 1,
          max_total_redemptions: null,
          new_customers_only: false,
          minimum_order_amount: null,
          notes: "Auto-created via campaign email",
          created_by: "campaign",
          customer_email: null,
          coupon_purpose: null,
        },
        { onConflict: "code", ignoreDuplicates: true }
      );

    if (!couponError) couponCreated = true;
    else console.error("[campaign] Failed to upsert coupon:", couponError.message);
  }

  return NextResponse.json({ sent, failed, total: subscribers.length, couponCreated });
}
