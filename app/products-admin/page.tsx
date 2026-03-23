import { AdminBar } from "@/app/components/AdminBar";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { ProductsAdminClient } from "./ProductsAdminClient";

export const dynamic = "force-dynamic";

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  status: "available" | "on_sale" | "sold";
  is_published: boolean;
  price_display_usd: number | null;
  public_id: string;
  slug: string;
  thumbnailUrl: string | null;
}

export default async function ProductsAdminPage() {
  const { data: rows } = await supabaseAdmin
    .from("products")
    .select("id, name, category, status, is_published, price_display_usd, public_id, slug, images")
    .order("created_at", { ascending: false });

  const products: AdminProduct[] = await Promise.all(
    (rows ?? []).map(async (p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      status: p.status,
      is_published: p.is_published,
      price_display_usd: p.price_display_usd,
      public_id: p.public_id,
      slug: p.slug,
      thumbnailUrl: await resolveFirstImageUrl(p.images ?? []),
    }))
  );

  return (
    <>
      <AdminBar />
      <ProductsAdminClient products={products} />
    </>
  );
}
