import { supabaseAdmin } from "@/lib/supabase-admin";
import { productSlug } from "@/lib/slug";
import { resolveFirstImageUrl } from "@/lib/storage";
import { NewDropsClient, type DropsProduct, type PickerSubscriber } from "./NewDropsClient";

export default async function NewDropsPage() {
  const [{ data: raw }, { data: subs }, { count }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, slug, public_id, price_display_usd, sale_price_usd, status, images, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("email_subscribers")
      .select("id, email, subscribed_at")
      .order("subscribed_at", { ascending: false }),
    supabaseAdmin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true }),
  ]);

  const products: DropsProduct[] = await Promise.all(
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
    <NewDropsClient
      products={products}
      subscribers={(subs ?? []) as PickerSubscriber[]}
      subscriberCount={count ?? 0}
    />
  );
}
