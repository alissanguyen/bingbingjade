import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildCampaignEmailHtml } from "@/lib/campaign-email";
import type { CampaignEmailEventProduct } from "@/lib/campaign-email";
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
    eventPricingApplied?: boolean;
    allowCouponStack?: boolean;
    eventDateRange?: string;
    // Provide either productIds (manual selection) or campaignEventId (auto-resolve)
    productIds?: string[];
    campaignEventId?: string;
    targetEmails?: string[] | null;
    bannerImage?: string;
  };

  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject    = body.subject?.trim();
  const headline   = body.headline?.trim();
  const intro      = body.intro?.trim();
  const ctaText    = body.ctaText?.trim();
  const ctaLink    = body.ctaLink?.trim();
  const bannerImage = body.bannerImage;

  if (!subject)  return NextResponse.json({ error: "Subject is required." },   { status: 400 });
  if (!headline) return NextResponse.json({ error: "Headline is required." },  { status: 400 });
  if (!intro)    return NextResponse.json({ error: "Intro is required." },     { status: 400 });
  if (!ctaText)  return NextResponse.json({ error: "CTA text is required." }, { status: 400 });
  if (!ctaLink)  return NextResponse.json({ error: "CTA link is required." }, { status: 400 });

  // ── Resolve products ──────────────────────────────────────────────────────────
  let products: CampaignEmailEventProduct[] = [];

  type ProductRow = {
    id: string; name: string; category: string; slug: string; public_id: string;
    show_price: boolean; price_display_usd: number | null; sale_price_usd: number | null;
    status: string; images: string[];
  };

  if (body.productIds && body.productIds.length > 0) {
    // Explicit product selection. If a campaignEventId is also provided, resolve
    // event pricing for those specific products from that campaign's discount config.
    const { data: raw } = await supabaseAdmin
      .from("products")
      .select("id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images")
      .in("id", body.productIds);

    if (raw && raw.length > 0) {
      // Preserve the order the user selected
      const ordered = body.productIds
        .map((id) => raw.find((p) => p.id === id))
        .filter(Boolean) as typeof raw;

      // If a campaign is linked, fetch per-product event_price_usd overrides
      const eventPriceOverrides = new Map<string, number | null>();
      let campaign: { discount_type: string | null; discount_value: number | null } | null = null;

      if (body.campaignEventId) {
        const [campaignRes, overrideRes] = await Promise.all([
          supabaseAdmin
            .from("campaign_events")
            .select("discount_type, discount_value")
            .eq("id", body.campaignEventId)
            .maybeSingle(),
          supabaseAdmin
            .from("campaign_event_products")
            .select("product_id, event_price_usd")
            .eq("campaign_id", body.campaignEventId)
            .in("product_id", body.productIds),
        ]);
        campaign = campaignRes.data ?? null;
        for (const row of overrideRes.data ?? []) {
          eventPriceOverrides.set(
            row.product_id as string,
            row.event_price_usd != null ? Number(row.event_price_usd) : null
          );
        }
      }

      products = await Promise.all(
        ordered.map(async (p): Promise<CampaignEmailEventProduct> => {
          let eventPrice: number | null = null;
          if (campaign) {
            const override = eventPriceOverrides.get(p.id);
            if (override != null) {
              eventPrice = override;
            } else if (campaign.discount_type === "percent" && campaign.discount_value != null && p.price_display_usd != null) {
              eventPrice = p.price_display_usd * (1 - campaign.discount_value / 100);
            } else if (campaign.discount_type === "fixed" && campaign.discount_value != null && p.price_display_usd != null) {
              eventPrice = Math.max(0, p.price_display_usd - campaign.discount_value);
            }
          }
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            slug: productSlug(p),
            show_price: p.show_price ?? false,
            price_display_usd: p.price_display_usd,
            sale_price_usd: p.sale_price_usd,
            event_price_usd: eventPrice,
            status: p.status,
            imageUrl: await resolveFirstImageUrl(p.images ?? []),
          };
        })
      );
    }
  } else if (body.campaignEventId) {
    // No explicit product selection — fall back to all campaign products with event pricing
    const { data: campaign } = await supabaseAdmin
      .from("campaign_events")
      .select("id, discount_type, discount_value")
      .eq("id", body.campaignEventId)
      .maybeSingle();

    if (campaign) {
      const { data: rows } = await supabaseAdmin
        .from("campaign_event_products")
        .select(`
          event_price_usd, sort_order, is_featured_for_email,
          products!inner (id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images)
        `)
        .eq("campaign_id", campaign.id)
        .order("is_featured_for_email", { ascending: false })
        .order("sort_order");

      if (rows && rows.length > 0) {
        products = await Promise.all(
          rows.map(async (row): Promise<CampaignEmailEventProduct> => {
            const p = row.products as unknown as ProductRow;
            let eventPrice: number | null = null;
            if (row.event_price_usd != null) {
              eventPrice = Number(row.event_price_usd);
            } else if (campaign.discount_type === "percent" && campaign.discount_value != null && p.price_display_usd != null) {
              eventPrice = p.price_display_usd * (1 - campaign.discount_value / 100);
            } else if (campaign.discount_type === "fixed" && campaign.discount_value != null && p.price_display_usd != null) {
              eventPrice = Math.max(0, p.price_display_usd - campaign.discount_value);
            }
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              slug: productSlug(p),
              show_price: p.show_price ?? false,
              price_display_usd: p.price_display_usd,
              sale_price_usd: p.sale_price_usd,
              event_price_usd: eventPrice,
              status: p.status,
              imageUrl: await resolveFirstImageUrl(p.images ?? []),
            };
          })
        );
      }
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
      eventPricingApplied: body.eventPricingApplied ?? false,
      allowCouponStack: body.allowCouponStack ?? true,
      eventDateRange: body.eventDateRange?.trim() || undefined,
      products: products.length > 0 ? products : undefined,
      unsubscribeUrl,
      siteUrl: SITE_URL,
      bannerImage,
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

  // Auto-create coupon in coupon_campaigns if a code + amount were included.
  // Skipped for campaign_event codes — those already exist in campaign_events.
  let couponCreated = false;
  const couponCode = body.discountCode?.trim().toUpperCase();
  if (couponCode && body.discountType && body.discountValue && body.discountValue > 0 && !body.campaignEventId) {
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
