import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { productSlug } from "@/lib/slug";
import { resolveFirstImageUrl } from "@/lib/storage";
import { ProductEmailClient, type EmailableProduct } from "./ProductEmailClient";

export const dynamic = "force-dynamic";

export default async function ProductEmailAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  // Fetch 40 most recently added published products
  const { data: raw } = await supabaseAdmin
    .from("products")
    .select("id, name, category, slug, public_id, price_display_usd, sale_price_usd, status, images, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(40);

  // Fetch subscriber count
  const { count } = await supabaseAdmin
    .from("email_subscribers")
    .select("id", { count: "exact", head: true });

  const products: EmailableProduct[] = await Promise.all(
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <ProductEmailClient products={products} subscriberCount={count ?? 0} />
    </div>
  );
}
