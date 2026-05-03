import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildProductShowcaseHtml, type EmailProduct } from "@/lib/product-email";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

// POST /api/admin/subscribers/product-email
// Body: { subject, intro, productIds: string[] }
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subject?: string; intro?: string; productIds?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  if (!subject) return NextResponse.json({ error: "subject is required." }, { status: 400 });

  const productIds = body.productIds ?? [];
  if (productIds.length === 0) return NextResponse.json({ error: "Select at least one product." }, { status: 400 });

  // Fetch selected products
  const { data: products, error: prodError } = await supabaseAdmin
    .from("products")
    .select("id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images")
    .in("id", productIds);

  if (prodError) return NextResponse.json({ error: prodError.message }, { status: 500 });
  if (!products || products.length === 0) return NextResponse.json({ error: "No products found." }, { status: 404 });

  // Preserve admin-chosen order
  const orderedProducts = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as typeof products;

  // Resolve first image URL for each product
  const emailProducts: EmailProduct[] = await Promise.all(
    orderedProducts.map(async (p) => ({
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

  // Fetch all subscriber emails + unsubscribe tokens
  const { data: subs, error: subError } = await supabaseAdmin
    .from("email_subscribers")
    .select("email, unsubscribe_token")
    .is("unsubscribed_at", null);

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });
  const subscribers = (subs ?? []).map((s) => ({ email: s.email, unsubscribeToken: s.unsubscribe_token }));
  if (subscribers.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  const renderHtml = (unsubscribeUrl: string) => buildProductShowcaseHtml({
    subject,
    intro: body.intro?.trim() ?? "",
    products: emailProducts,
    unsubscribeUrl,
    siteUrl: SITE_URL,
  });

  const { sent, failed } = await sendBulkSubscriberEmail({ subscribers, subject, renderHtml, siteUrl: SITE_URL });
  return NextResponse.json({ sent, failed, total: subscribers.length });
}
