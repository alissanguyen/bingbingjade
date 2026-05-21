export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { productSlug } from "@/lib/slug";
import { resolveImageUrl, resolveFirstImageUrl } from "@/lib/storage";
import { CollectionDropsClient, type CollectionOption, type CollectionScene, type PickerSubscriber } from "./CollectionDropsClient";

export default async function CollectionDropsPage() {
  const [{ data: rawCollections }, { data: subs }, { count }] = await Promise.all([
    supabaseAdmin
      .from("collections")
      .select(`
        id, name, slug, description, status,
        collection_scenes!collection_id ( id, image, sort_order ),
        collection_products (
          sort_order,
          products ( id, name, category, slug, public_id, price_display_usd, sale_price_usd, status, images )
        )
      `)
      .eq("status", "published")
      .order("sort_order", { ascending: true }),
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

  const collections: CollectionOption[] = await Promise.all(
    (rawCollections ?? []).map(async (col) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawScenes = ((col.collection_scenes ?? []) as any[]).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const scenes: CollectionScene[] = await Promise.all(
        rawScenes.map(async (s) => ({
          id: s.id as string,
          imageUrl: s.image ? await resolveImageUrl(s.image as string) : null,
          sortOrder: s.sort_order ?? 0,
        }))
      );

      type RawP = { id: string; name: string; category: string; slug: string; public_id: string; price_display_usd: number | null; sale_price_usd: number | null; status: string; images: string[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawProds = ((col.collection_products ?? []) as any[])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((cp) => (Array.isArray(cp.products) ? cp.products[0] : cp.products) as RawP | undefined)
        .filter((p): p is RawP => p != null);

      const products = await Promise.all(
        rawProds.map(async (p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          imageUrl: await resolveFirstImageUrl(p.images ?? []),
          price_display_usd: p.price_display_usd,
          sale_price_usd: p.sale_price_usd,
          status: p.status,
        }))
      );

      return {
        id: col.id,
        name: col.name,
        slug: col.slug,
        description: col.description ?? null,
        scenes,
        products,
      };
    })
  );

  return (
    <CollectionDropsClient
      collections={collections}
      subscribers={(subs ?? []) as PickerSubscriber[]}
      subscriberCount={count ?? 0}
    />
  );
}
