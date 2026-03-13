import { supabase } from "@/lib/supabase";
import { ProductForm } from "./ProductForm";

export default async function AddProductPage() {
  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Add Product</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the details below to list a new jade piece.</p>
      </div>
      <ProductForm vendors={vendors ?? []} />
    </div>
  );
}
