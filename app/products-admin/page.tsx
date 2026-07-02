import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { fetchAllRows } from "@/lib/supabase-fetch-all";
import { ProductsAdminClient } from "./ProductsAdminClient";

export const dynamic = "force-dynamic";

export interface AdminProduct {
  id: string;
  name: string;
  category: string;
  status: "available" | "on_sale" | "sold" | "archived";
  is_published: boolean;
  is_clearance: boolean;
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
  const session = await getSessionUser();
  const adminUser = isAdmin(session);

  // admin table — batched fetch so the 1000-row Supabase cap is never hit
  const [rows, pendingRows] = await Promise.all([
    fetchAllRows((from, to) =>
      supabaseAdmin
        .from("products")
        .select("id, name, category, status, is_published, is_clearance, quick_ship, price_display_usd, public_id, slug, images, created_at, renewed_at")
        .eq("pending_approval", false)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabaseAdmin
        .from("products")
        .select("id, name, category, images, pending_data, created_by")
        .eq("pending_approval", true)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
  ]);

  // Resolve approved-user names for pending queue
  const approvedIds = [...new Set(
    pendingRows
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

  rows.sort((a, b) => {
    const da = new Date((a.renewed_at ?? a.created_at) as string).getTime();
    const db = new Date((b.renewed_at ?? b.created_at) as string).getTime();
    return db - da;
  });

  const [products, pendingProducts] = await Promise.all([
    Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        status: p.status,
        is_published: p.is_published,
        is_clearance: p.is_clearance ?? false,
        quick_ship: p.quick_ship ?? false,
        price_display_usd: p.price_display_usd,
        public_id: p.public_id,
        slug: p.slug,
        thumbnailUrl: await resolveFirstImageUrl(p.images ?? []),
      } satisfies AdminProduct))
    ),
    Promise.all(
      pendingRows.map(async (p) => {
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
      <ProductsAdminClient products={products} pendingProducts={pendingProducts} isAdmin={adminUser} />
    </>
  );
}
