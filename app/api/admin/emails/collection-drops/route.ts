import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrl, resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { sendBulkSubscriberEmail } from "@/lib/discount-emails";
import { buildCollectionDropsHtml, type EmailProduct } from "@/lib/collection-email";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preview = req.nextUrl.searchParams.get("preview") === "1";

  let body: {
    collectionId?: string;
    subject?: string;
    intro?: string;
    sceneIds?: string[];
    productIds?: string[];
    targetEmails?: string[] | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  if (!subject) return NextResponse.json({ error: "subject is required." }, { status: 400 });
  if (!body.collectionId) return NextResponse.json({ error: "collectionId is required." }, { status: 400 });

  const { data: collection } = await supabaseAdmin
    .from("collections")
    .select(`
      id, name, slug, description,
      collection_scenes!collection_id ( id, image, sort_order ),
      collection_products (
        sort_order,
        products ( id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images )
      )
    `)
    .eq("id", body.collectionId)
    .single();

  if (!collection) return NextResponse.json({ error: "Collection not found." }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allScenes = ((collection.collection_scenes ?? []) as any[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Filter to selected scene IDs (preserve sort order), falling back to all scenes
  const selectedScenes = body.sceneIds?.length
    ? body.sceneIds
        .map((id) => allScenes.find((s) => s.id === id))
        .filter(Boolean)
    : allScenes;

  const sceneImageUrls: string[] = (
    await Promise.all(
      selectedScenes.map((s) => s.image ? resolveImageUrl(s.image as string) : Promise.resolve(null))
    )
  ).filter((url): url is string => url !== null);

  type RawProduct = { id: string; name: string; category: string; slug: string; public_id: string; show_price: boolean; price_display_usd: number | null; sale_price_usd: number | null; status: string; images: string[] };

  // Build the product list from the collection, filtered to selected IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCollectionProducts = ((collection.collection_products ?? []) as any[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((cp) => (Array.isArray(cp.products) ? cp.products[0] : cp.products) as RawProduct | undefined)
    .filter((p): p is RawProduct => p != null);

  const selectedProducts: RawProduct[] = body.productIds?.length
    ? body.productIds
        .map((id) => allCollectionProducts.find((p) => p.id === id))
        .filter((p): p is RawProduct => p != null)
    : allCollectionProducts;

  const emailProducts: EmailProduct[] = await Promise.all(
    selectedProducts.map(async (p) => ({
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

  const renderHtml = (unsubscribeUrl: string) => buildCollectionDropsHtml({
    collectionName: collection.name,
    collectionSlug: collection.slug,
    sceneImageUrls,
    subject,
    intro: body.intro?.trim() ?? "",
    products: emailProducts,
    unsubscribeUrl,
    siteUrl: SITE_URL,
  });

  if (preview) return NextResponse.json({ html: renderHtml(`${SITE_URL}/api/unsubscribe?token=preview`) });

  let subscribers: { email: string; unsubscribeToken?: string }[];
  if (body.targetEmails && body.targetEmails.length > 0) {
    subscribers = body.targetEmails.map((email) => ({ email }));
  } else {
    const { data: subs } = await supabaseAdmin
      .from("email_subscribers")
      .select("email, unsubscribe_token")
      .is("unsubscribed_at", null);
    subscribers = (subs ?? []).map((s: { email: string; unsubscribe_token?: string }) => ({ email: s.email, unsubscribeToken: s.unsubscribe_token }));
  }

  if (subscribers.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  const { sent, failed } = await sendBulkSubscriberEmail({ subscribers, subject, renderHtml, siteUrl: SITE_URL });
  return NextResponse.json({ sent, failed, total: subscribers.length });
}
