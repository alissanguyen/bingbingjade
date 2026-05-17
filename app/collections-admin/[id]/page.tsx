import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { resolveImageUrl } from "@/lib/storage";
import { CollectionAdminClient } from "./CollectionAdminClient";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function CollectionAdminDetailPage({ params }: Params) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  const { id } = await params;

  const { data: collection } = await supabaseAdmin
    .from("collections")
    .select(`
      *,
      collection_scenes!collection_id (
        id, image, mobile_image, caption, sort_order,
        collection_scene_tags (
          id, x, y, mobile_x, mobile_y,
          products ( id, name, slug, images, price_display_usd, sale_price_usd, show_price, status )
        )
      ),
      collection_products (
        id, sort_order,
        products ( id, name, slug, public_id, category, images, price_display_usd, status )
      )
    `)
    .eq("id", id)
    .order("sort_order", { referencedTable: "collection_scenes" })
    .order("sort_order", { referencedTable: "collection_products" })
    .single();

  if (!collection) notFound();

  // Resolve scene image URLs for display in admin
  const scenesWithUrls = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (collection.collection_scenes ?? []).map(async (s: any) => ({
      ...s,
      imageUrl: s.image ? await resolveImageUrl(s.image as string) : "",
      mobileImageUrl: s.mobile_image ? await resolveImageUrl(s.mobile_image as string) : null,
    }))
  );

  return (
    <CollectionAdminClient
      collection={{ ...collection, collection_scenes: scenesWithUrls }}
    />
  );
}
