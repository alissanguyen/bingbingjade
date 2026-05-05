import { supabaseAdmin } from "@/lib/supabase-admin";
import { productSlug } from "@/lib/slug";
import { resolveFirstImageUrl } from "@/lib/storage";
import { CampaignClient, type CampaignProduct, type PickerSubscriber } from "./CampaignClient";

export default async function CampaignEmailPage() {
  const [{ data: raw }, { data: subs }, { count }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, slug, public_id, price_display_usd, sale_price_usd, status, images, created_at")
      .eq("is_published", true)
      .neq("status", "sold")
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("email_subscribers")
      .select("id, email, subscribed_at")
      .is("unsubscribed_at", null)
      .order("subscribed_at", { ascending: false }),
    supabaseAdmin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null),
  ]);

  const products: CampaignProduct[] = await Promise.all(
    (raw ?? []).map(async (p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      slug: productSlug(p),
      price_display_usd: p.price_display_usd,
      sale_price_usd: p.sale_price_usd,
      status: p.status,
      imageUrl: await resolveFirstImageUrl(p.images ?? []),
      created_at: p.created_at,
    }))
  );

  return (
    <CampaignClient
      products={products}
      subscribers={(subs ?? []) as PickerSubscriber[]}
      subscriberCount={count ?? 0}
    />
  );
}
