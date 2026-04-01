import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrls, isStoragePath } from "@/lib/storage";
import { ProductSearch } from "./ProductSearch";
import { AdminBarServer } from "@/app/components/AdminBarServer";

export default async function EditPage() {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, category, status, is_published, images")
    .order("created_at", { ascending: false });

  const raw = products ?? [];
  const firstImages = raw.map((p) => p.images?.[0] ?? "");
  const resolvedFirstImages = firstImages.some(isStoragePath)
    ? await resolveImageUrls(firstImages)
    : firstImages;
  const productsWithDisplayImages = raw.map((p, i) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status as "available" | "on_sale" | "sold",
    is_published: p.is_published as boolean,
    images: resolvedFirstImages[i] ? [resolvedFirstImages[i]] : [],
  }));

  return (
    <>
      <AdminBarServer />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Product</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search and select a product to edit.</p>
        </div>
        <ProductSearch products={productsWithDisplayImages} />
      </div>
    </>
  );
}
