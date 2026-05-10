import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { CampaignDetailClient } from "./CampaignDetailClient";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [campaignRes, campaignProductsRes, allProductsRes] = await Promise.all([
    supabaseAdmin.from("campaign_events").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("campaign_event_products")
      .select(`
        id, event_price_usd, sort_order, is_featured_for_email, created_at, product_id,
        products!inner (id, name, slug, public_id, category, price_display_usd, sale_price_usd, status, images)
      `)
      .eq("campaign_id", id)
      .order("sort_order")
      .order("created_at"),
    supabaseAdmin
      .from("products")
      .select("id, name, slug, public_id, category, price_display_usd, sale_price_usd, status, images")
      .eq("is_published", true)
      .not("status", "in", '("sold","archived")')
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (campaignRes.error || !campaignRes.data) notFound();
  const campaign = campaignRes.data;

  // Resolve first image URL for campaign products
  const campaignProducts = await Promise.all(
    (campaignProductsRes.data ?? []).map(async (cp) => {
      const p = cp.products as unknown as { id: string; name: string; slug: string; public_id: string; category: string; price_display_usd: number | null; sale_price_usd: number | null; status: string; images: string[] };
      return {
        id: cp.id,
        product_id: cp.product_id as string,
        event_price_usd: cp.event_price_usd as number | null,
        sort_order: cp.sort_order as number,
        is_featured_for_email: cp.is_featured_for_email as boolean,
        product: {
          id: p.id,
          name: p.name,
          slug: productSlug(p),
          category: p.category,
          price_display_usd: p.price_display_usd,
          sale_price_usd: p.sale_price_usd,
          status: p.status,
          imageUrl: await resolveFirstImageUrl(p.images ?? []),
        },
      };
    })
  );

  // All products for the picker (resolve image URL)
  const allProducts = await Promise.all(
    (allProductsRes.data ?? []).map(async (p) => ({
      id: p.id,
      name: p.name,
      slug: productSlug(p),
      category: p.category,
      price_display_usd: p.price_display_usd,
      sale_price_usd: p.sale_price_usd,
      status: p.status,
      imageUrl: await resolveFirstImageUrl(p.images ?? []),
    }))
  );

  return (
    <CampaignDetailClient
      campaign={campaign}
      campaignProducts={campaignProducts}
      allProducts={allProducts}
    />
  );
}
