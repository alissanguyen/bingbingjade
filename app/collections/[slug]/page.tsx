import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveImageUrl } from "@/lib/storage";
import { CollectionScene } from "@/app/components/collection/CollectionScene";
import { ProductCardLink } from "@/app/products/ProductCardLink";
import { ProductCardImage } from "@/app/products/ProductCardImage";

export const revalidate = 120;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("collections")
    .select("name, subtitle")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (!data) return { title: "Collection — BingBing Jade" };
  return {
    title: `${data.name} — BingBing Jade`,
    description: data.subtitle ?? undefined,
  };
}

export default async function CollectionPage({ params }: Params) {
  const { slug } = await params;

  const { data: collection } = await supabase
    .from("collections")
    .select(`
      id, name, subtitle, description, hero_image, status,
      collection_scenes (
        id, image, mobile_image, caption, sort_order,
        collection_scene_tags (
          id, x, y,
          products ( id, name, slug, images, price_display_usd, sale_price_usd, show_price, status )
        )
      ),
      collection_products (
        id, sort_order,
        products ( id, name, slug, public_id, category, images, price_display_usd, sale_price_usd, show_price, status, quick_ship )
      )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .order("sort_order", { referencedTable: "collection_scenes" })
    .order("sort_order", { referencedTable: "collection_products" })
    .single();

  if (!collection) notFound();

  // Resolve image URLs
  const heroUrl = collection.hero_image
    ? await resolveImageUrl(collection.hero_image)
    : null;

  const scenes = await Promise.all(
    (collection.collection_scenes ?? []).map(async (s) => ({
      id: s.id,
      imageUrl: await resolveImageUrl(s.image),
      mobileImageUrl: s.mobile_image ? await resolveImageUrl(s.mobile_image) : null,
      caption: s.caption,
      tags: (s.collection_scene_tags ?? []).map((tag) => {
        const p = Array.isArray(tag.products) ? tag.products[0] : tag.products;
        return { id: tag.id as string, x: tag.x as number, y: tag.y as number, products: p as { id: string; name: string; slug: string; images: string[]; price_display_usd: number | null; sale_price_usd: number | null; show_price: boolean; status: string } };
      }).filter((t) => t.products),
    }))
  );

  const products = (collection.collection_products ?? [])
    .map((cp) => (Array.isArray(cp.products) ? cp.products[0] : cp.products) as {
      id: string; name: string; slug: string; public_id: string | null;
      category: string | null; images: string[]; price_display_usd: number | null;
      sale_price_usd: number | null; show_price: boolean; status: string; quick_ship: boolean | null;
    } | null)
    .filter(Boolean);

  const [heroScene, ...restScenes] = scenes;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[60vh] sm:min-h-[75vh] flex items-end overflow-hidden bg-gray-900">
        {heroUrl ? (
          <Image
            src={heroScene ? heroScene.imageUrl : heroUrl}
            alt={collection.name}
            fill
            className="object-cover opacity-80"
            priority
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 to-gray-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative z-10 px-6 pb-12 sm:px-12 sm:pb-16 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-3">
            Collection
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight mb-4">
            {collection.name}
          </h1>
          {collection.subtitle && (
            <p className="text-lg sm:text-xl text-white/70 leading-relaxed max-w-xl">
              {collection.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* ── Description ─────────────────────────────────────────────────── */}
      {collection.description && (
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            {collection.description}
          </p>
        </div>
      )}

      {/* ── Editorial Masonry ─────────────────────────────────────────────── */}
      {scenes.length > 0 && (
        <section className="px-3 sm:px-6 pb-16 max-w-screen-xl mx-auto">
          {/* First scene was used as hero if hero_image is null, skip it in masonry */}
          {(() => {
            const masonryScenes = heroUrl ? scenes : restScenes;
            if (masonryScenes.length === 0) return null;
            return (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
                {masonryScenes.map((scene) => (
                  <div key={scene.id} className="break-inside-avoid mb-3">
                    <CollectionScene scene={scene} />
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Shop the Collection ───────────────────────────────────────────── */}
      {products.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 sm:px-6 pb-20">
          <div className="flex items-center gap-6 mb-8">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500 shrink-0">
              Shop the Collection
            </h2>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {products.map((product) => {
              if (!product) return null;
              const isSold = product.status === "sold";
              return (
                <ProductCardLink
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className={`group flex flex-col gap-2 ${isSold ? "opacity-60" : ""}`}
                >
                  <div className="overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900">
                    <ProductCardImage images={product.images ?? []} name={product.name} />
                  </div>
                  <div className="px-0.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {product.name}
                    </p>
                    {product.show_price && (product.sale_price_usd ?? product.price_display_usd) && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                          .format(((product.sale_price_usd ?? product.price_display_usd) as number) / 100)}
                      </p>
                    )}
                    {isSold && (
                      <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">Sold</p>
                    )}
                  </div>
                </ProductCardLink>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              Browse All Pieces
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
