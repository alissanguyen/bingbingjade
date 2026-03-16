import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ProductGallery } from "./ProductGallery";

interface Product {
  id: string;
  name: string;
  category: string;
  images: string[];
  videos: string[] | null;
  color: string[] | null;
  tier: string;
  size: number;
  price_display_usd: number | null;
  description: string | null;
  blemishes: string | null;
  is_featured: boolean | null;
  status: string;
}

const COLOR_SWATCHES: Record<string, string> = {
  white: "bg-white border border-gray-300",
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  pink: "bg-pink-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  black: "bg-gray-900",
  marbling: "bg-gradient-to-br from-gray-200 via-white to-gray-400 border border-gray-300",
};

export const revalidate = 21600;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: product } = await supabase
    .from("products")
    .select("id, name, category, images, videos, color, tier, size, price_display_usd, description, blemishes, is_featured, status")
    .eq("id", id)
    .single<Product>();

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Back */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-8"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to products
      </Link>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Gallery */}
        <ProductGallery images={product.images ?? []} videos={product.videos ?? []} />

        {/* Details */}
        <div className="flex flex-col">
          {/* Category + tier + featured */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-md font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {product.category}
            </span>
            {product.tier && (
              <span className="text-sm font-bold text-gray-400 dark:text-gray-500">· {product.tier}</span>
            )}
            {product.is_featured && (
              <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Featured
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {product.name}
          </h1>

          {/* Price */}
          <p className="mt-3 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {product.price_display_usd != null
              ? `$${Number(product.price_display_usd).toFixed(2)}`
              : "Contact for price"}
          </p>

          <div className="mt-6 space-y-5">
            {/* Color tags */}
            {(product.color?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.color!.map((c: string) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Size */}
            {product.size != null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Size</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{product.size} mm</p>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {/* Blemishes */}
            {product.blemishes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Blemishes</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{product.blemishes}</p>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            {/* Status badge */}
            <div className="mb-4">
              {product.status === "sold" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-1 text-sm font-semibold text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Sold
                </span>
              ) : product.status === "on_sale" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  On Sale
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Available
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Interested in this piece? Reach out directly to inquire or purchase.
            </p>
            <Link
              href="/contact"
              className={`block w-full rounded-full py-3 text-center text-sm font-medium text-white transition-colors ${
                product.status === "sold"
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed pointer-events-none"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {product.status === "sold" ? "This item has been sold" : "Contact to Purchase"}
            </Link>
            <div className="text-sm">
              <p className="italic text-cyan-600 font-semibold  mt-4">** We provide more pictures and videos of different lighting upon request.</p>
              <p className="text-gray-400 dark:text-gray-500 mt-2"><span className="mr-2 text-cyan-600">Not your styles?</span>Some pieces can be <span className="font-semibold text-gray-500">reshaped</span> or <span className="font-semibold text-gray-500">widened</span>, contact us for more details. <p></p></p>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
