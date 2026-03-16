import { supabaseAdmin } from "@/lib/supabase-admin";
import { ProductSearch } from "./ProductSearch";
import { AdminBar } from "@/app/components/AdminBar";

export default async function EditPage() {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, category, images")
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminBar />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Product</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search and select a product to edit.</p>
        </div>
        <ProductSearch products={products ?? []} />
      </div>
    </>
  );
}
