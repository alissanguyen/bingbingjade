import { AdminBarServer } from "@/app/components/AdminBarServer";
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
  quick_ship: boolean;
  price_display_usd: number | null;
  public_id: string;
  slug: string;
  thumbnailUrl: string | null;
}

export interface PendingProduct {
  id: string;
  name: string;
  category: string;
  isEdit: boolean;          // true = pending edit, false = new listing
  submitterName: string;
  thumbnailUrl: string | null;
}

export default async function ProductsAdminPage() {
  const [{ data: rows }, { data: pendingRows }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, category, status, is_published, quick_ship, price_display_usd, public_id, slug, images")
      .eq("pending_approval", false)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("products")
      .select("id, name, category, images, pending_data, created_by")
      .eq("pending_approval", true)
      .order("created_at", { ascending: false }),
  ]);

  // Resolve approved-user names for pending queue
  const approvedIds = [...new Set(
    (pendingRows ?? [])
      .map((p) => p.created_by?.startsWith("approved:") ? p.created_by.replace("approved:", "") : null)
      .filter(Boolean) as string[]
  )];
  const nameMap: Record<string, string> = {};
  if (approvedIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("approved_users")
      .select("id, full_name")
      .in("id", approvedIds);
    (users ?? []).forEach((u) => { nameMap[u.id] = u.full_name; });
  }

  const [products, pendingProducts] = await Promise.all([
    Promise.all(
      (rows ?? []).map(async (p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        status: p.status,
        is_published: p.is_published,
        quick_ship: p.quick_ship ?? false,
        price_display_usd: p.price_display_usd,
        public_id: p.public_id,
        slug: p.slug,
        thumbnailUrl: await resolveFirstImageUrl(p.images ?? []),
      } satisfies AdminProduct))
    ),
    Promise.all(
      (pendingRows ?? []).map(async (p) => {
        const uid = p.created_by?.startsWith("approved:") ? p.created_by.replace("approved:", "") : null;
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          isEdit: p.pending_data !== null,
          submitterName: uid ? (nameMap[uid] ?? "Partner") : "Admin",
          thumbnailUrl: await resolveFirstImageUrl(p.images ?? []),
        } satisfies PendingProduct;
      })
    ),
  ]);

  return (
    <>
      <AdminBarServer />
      <ProductsAdminClient products={products} pendingProducts={pendingProducts} />
    </>
  );
}
