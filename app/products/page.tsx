import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/product";

export const revalidate = 21600; // revalidate every 6 hours as fallback

export default async function Products() {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load products:", error.message);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Browse our collection of authentic jade pieces.</p>

      {!products || products.length === 0 ? (
        <p className="mt-16 text-center text-gray-400 dark:text-gray-600">
          No products listed yet. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product: Product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 hover:shadow-md transition-shadow"
            >
              <div className="h-40 rounded-xl bg-emerald-50 dark:bg-emerald-950 overflow-hidden mb-4">
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🪨</div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  {product.category}
                </span>
                {product.tier && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">· {product.tier}</span>
                )}
              </div>

              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{product.description}</p>

              <div className="mt-4 flex items-center justify-between">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Contact for price"}
                </span>
                {product.size && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Size {product.size}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
