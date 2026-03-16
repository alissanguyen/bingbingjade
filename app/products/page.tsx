import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ProductCard {
  id: string;
  name: string;
  category: string;
  images: string[];
  color: string[] | null;
  tier: string;
  size: number;
  price_display_usd: number | null;
  description: string | null;
  is_featured: boolean;
}

const COLOR_SWATCHES: Record<string, string> = {
  white:    "bg-white border border-gray-300",
  green:    "bg-green-500",
  blue:     "bg-blue-500",
  red:      "bg-red-500",
  pink:     "bg-pink-400",
  purple:   "bg-purple-500",
  orange:   "bg-orange-500",
  yellow:   "bg-yellow-400",
  black:    "bg-gray-900",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

export const revalidate = 21600; // revalidate every 6 hours as fallback

export default async function Products() {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, category, images, color, tier, size, price_display_usd, description, is_featured")
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
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {(products as ProductCard[]).map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700 transition-all block"
            >
              {/* Image strip — slides to peek at second image on hover */}
              <div className="w-full aspect-square bg-emerald-50 dark:bg-emerald-950 overflow-hidden">
                {product.images?.[0] ? (
                  <div className={`grid h-full ${product.images.length >= 2 ? "w-[200%] grid-cols-2 group-hover:animate-peek" : "w-full grid-cols-1"}`}>
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    {product.images[1] && (
                      <img src={product.images[1]} alt="" className="w-full h-full object-cover" aria-hidden="true" />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🪨</div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                {/* Category + tier row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {product.category}
                  </span>
                  {product.tier && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">· {product.tier}</span>
                  )}
                </div>

                <h2 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{product.name}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{product.description}</p>

                {/* Color tags */}
                {(product.color ?? []).filter((c) => c && c.trim()).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(product.color ?? []).filter((c) => c && c.trim()).map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Price + size */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {product.price_display_usd != null ? `$${product.price_display_usd.toFixed(2)}` : "Contact for price"}
                  </span>
                  {product.size && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Size {product.size}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
