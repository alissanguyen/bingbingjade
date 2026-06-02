import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrl } from "@/lib/storage";
import { CollectionScene } from "@/app/components/collection/CollectionScene";
import { CollectionStory } from "@/app/components/collection/CollectionStory";
import { ProductCardLink } from "@/app/products/ProductCardLink";
import { ProductCardImage } from "@/app/products/ProductCardImage";
import { requiresInquiry } from "@/lib/price";
import { productSlug } from "@/lib/slug";
import { getCategoryLabel } from "@/app/products/categories";
import { ProductListing, type ProductSearchParams } from "@/app/products/page";
import { COLLECTION_FILTERS, curatedFilterToSearchParams } from "@/lib/curated-routes";

export const revalidate = 120;

const SITE_URL = "https://bingbingjade.com";

type Params = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductSearchParams>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const curated = COLLECTION_FILTERS[slug];
  if (curated) {
    return {
      title: `${curated.title} — BingBing Jade`,
      description: curated.description,
      alternates: { canonical: curated.href },
      openGraph: {
        title: `${curated.title} — BingBing Jade`,
        description: curated.description,
        url: `${SITE_URL}${curated.href}`,
        type: "website",
        images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: curated.title }],
      },
    };
  }

  const { data } = await supabaseAdmin
    .from("collections")
    .select("name, subtitle, status")
    .eq("slug", slug)
    .single();
  if (!data) return { title: "Collection — BingBing Jade" };
  return {
    title: `${data.name} — BingBing Jade`,
    description: data.subtitle ?? undefined,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      title: `${data.name} — BingBing Jade`,
      description: data.subtitle ?? undefined,
      url: `${SITE_URL}/collections/${slug}`,
      type: "website",
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: data.name }],
    },
  };
}

export default async function CollectionPage({ params, searchParams = Promise.resolve({}) }: Params) {
  const { slug } = await params;
  const curated = COLLECTION_FILTERS[slug];

  if (curated) {
    return (
      <ProductListing
        searchParams={searchParams}
        baseParams={curatedFilterToSearchParams(curated.filters)}
        pathname={curated.href}
        intro={{
          eyebrow: curated.eyebrow,
          title: curated.title,
          description: curated.description,
          breadcrumbs: [
            { label: "Home", href: "/" },
            { label: "Collections", href: "/products" },
            { label: curated.title },
          ],
        }}
      />
    );
  }

  // Check existence and status first (admin client bypasses RLS so drafts are visible)
  const { data: meta } = await supabaseAdmin
    .from("collections")
    .select("id, name, subtitle, hero_image, status")
    .eq("slug", slug)
    .single();

  if (!meta) notFound();

  // ── Draft: rich branded coming-soon page ──────────────────────────────────
  if (meta.status !== "published") {
    const heroUrl = meta.hero_image ? await resolveImageUrl(meta.hero_image) : null;

    return (
      <main className="min-h-screen bg-gray-950">
        {/* Full-bleed hero */}
        <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden">
          {heroUrl ? (
            <Image
              src={heroUrl}
              alt={meta.name}
              fill
              className="object-cover opacity-30"
              priority
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-gray-950 to-gray-900" />
          )}

          {/* Vignette */}
          <div className="absolute inset-0 bg-linear-to-t from-gray-950/80 via-transparent to-gray-950/40" />

          {/* Content */}
          <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-400 mb-6">
              Coming Soon
            </p>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-5 tracking-tight">
              {meta.name}
            </h1>

            {meta.subtitle && (
              <p className="text-base sm:text-lg text-white/60 leading-relaxed mb-10 max-w-lg mx-auto">
                {meta.subtitle}
              </p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 mb-10 justify-center">
              <div className="w-12 h-px bg-emerald-700/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
              <div className="w-12 h-px bg-emerald-700/60" />
            </div>

            <p className="text-sm text-white/40 mb-10 tracking-wide">
              This collection is being curated. Check back soon.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                Shop All Pieces
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-white/20 hover:border-white/40 text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Published: full collection page ──────────────────────────────────────
  // Use supabaseAdmin so RLS can't block the fetch — we already verified status above.
  const { data: collection } = await supabaseAdmin
    .from("collections")
    .select(`
      *,
      collection_scenes!collection_id (
        id, image, mobile_image, caption, sort_order,
        collection_scene_tags (
          id, x, y, mobile_x, mobile_y,
          products ( id, name, slug, public_id, images, price_display_usd, sale_price_usd, show_price, status )
        )
      ),
      collection_products (
        id, sort_order,
        products ( id, name, slug, public_id, category, images, price_display_usd, sale_price_usd, show_price, status, quick_ship, size, tier, origin )
      )
    `)
    .eq("id", meta.id)
    .order("sort_order", { referencedTable: "collection_scenes" })
    .order("sort_order", { referencedTable: "collection_products" })
    .single();

  if (!collection) notFound();

  const heroUrl = collection.hero_image
    ? await resolveImageUrl(collection.hero_image)
    : null;

  type RawTagProduct = {
    id: string; name: string; slug: string; public_id: string | null;
    images: string[]; price_display_usd: number | null; sale_price_usd: number | null;
    show_price: boolean; status: string;
  };
  type RawSceneTag = {
    id: string; x: number; y: number; mobile_x: number | null; mobile_y: number | null;
    products: RawTagProduct | RawTagProduct[] | null;
  };
  type RawScene = {
    id: string; image: string; mobile_image: string | null; caption: string | null;
    collection_scene_tags: RawSceneTag[] | null;
  };
  type RawCollectionProduct = {
    products: ({
      id: string; name: string; slug: string; public_id: string | null;
      category: string | null; images: string[]; price_display_usd: number | null;
      sale_price_usd: number | null; show_price: boolean; status: string; quick_ship: boolean | null;
      size: number | null; tier: string[] | null; origin: string | null;
    }) | ({
      id: string; name: string; slug: string; public_id: string | null;
      category: string | null; images: string[]; price_display_usd: number | null;
      sale_price_usd: number | null; show_price: boolean; status: string; quick_ship: boolean | null;
      size: number | null; tier: string[] | null; origin: string | null;
    })[] | null;
  };

  const scenes = await Promise.all(
    ((collection.collection_scenes ?? []) as unknown as RawScene[])
      .filter((s) => s.image)
      .map(async (s) => ({
        id: s.id,
        imageUrl: await resolveImageUrl(s.image),
        mobileImageUrl: s.mobile_image ? await resolveImageUrl(s.mobile_image) : null,
        caption: s.caption,
        tags: (s.collection_scene_tags ?? []).map((tag) => {
          const p = Array.isArray(tag.products) ? tag.products[0] : tag.products;
          return {
            id: tag.id, x: tag.x, y: tag.y,
            mobile_x: tag.mobile_x ?? null,
            mobile_y: tag.mobile_y ?? null,
            products: p,
          };
        }).filter((t): t is typeof t & { products: RawTagProduct } => t.products != null),
      }))
  );

  const products = ((collection.collection_products ?? []) as unknown as RawCollectionProduct[])
    .map((cp) => (Array.isArray(cp.products) ? cp.products[0] : cp.products))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const [, ...restScenes] = scenes;

  // Resolve hero banner: admin-selected scene → hero_image upload → dark gradient
  const heroBannerScene = collection.hero_scene_id
    ? scenes.find((s) => s.id === collection.hero_scene_id) ?? null
    : null;
  const bannerImageUrl = heroBannerScene?.imageUrl ?? heroUrl;
  const bannerMobileUrl = heroBannerScene?.mobileImageUrl ?? null;

  // hero_focal_* columns exist in the DB but may not be reflected in generated types yet
  const col = collection as typeof collection & {
    hero_focal_x?: number | null; hero_focal_y?: number | null;
    hero_mobile_focal_x?: number | null; hero_mobile_focal_y?: number | null;
  };
  const focalX  = col.hero_focal_x  ?? 50;
  const focalY  = col.hero_focal_y  ?? 50;
  const focalMX = col.hero_mobile_focal_x ?? focalX;
  const focalMY = col.hero_mobile_focal_y ?? focalY;
  const heroClass = `collection-hero-${meta.id}`;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[50vh] sm:min-h-[65vh] flex items-end overflow-hidden bg-gray-900">
        {bannerImageUrl ? (
          <>
            <style>{`.${heroClass}{object-position:${focalX}% ${focalY}%}@media(max-width:639px){.${heroClass}{object-position:${focalMX}% ${focalMY}%}}`}</style>
            <picture>
              {bannerMobileUrl && <source media="(max-width: 639px)" srcSet={bannerMobileUrl} />}
              <Image
                src={bannerImageUrl}
                alt={collection.name}
                fill
                className={`object-cover ${heroClass}`}
                priority
                unoptimized
              />
            </picture>
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-emerald-950 to-gray-950" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative z-10 px-6 pb-12 sm:px-12 sm:pb-16 max-w-3xl">
          <p className="text-[9px] sm:text-[13px] font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-3">
            BINGBING EXCLUSIVE
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight mb-4">
            {collection.name}
          </h1>
          {collection.subtitle && (
            <p className="text-[16px] sm:text-xl text-white/70 leading-relaxed max-w-xl">
              {collection.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* ── Description ─────────────────────────────────────────────────── */}
      {collection.description && (
        <div className="max-w-2xl mx-auto px-6 py-8 sm:py-12 text-center">
          <p className="text-[14px] sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            {collection.description}
          </p>
        </div>
      )}

      {/* ── BingBing Difference ──────────────────────────────────────────── */}
      <CollectionStory />

      {/* ── Editorial Masonry ─────────────────────────────────────────────── */}
      {scenes.length > 0 && (
        <section className="px-3 sm:px-6 lg:px-16 pb-16 max-w-8xl mx-auto">
          {(() => {
            const masonryScenes = (bannerImageUrl) ? scenes : restScenes;
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
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
              const isOnSale = product.status === "on_sale" && product.sale_price_usd != null;
              const fmt = (p: number) =>
                new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
              const salePrice = product.show_price ? product.sale_price_usd : null;
              const origPrice = product.show_price ? product.price_display_usd : null;
              const displayPrice = salePrice ?? origPrice;
              const hasSale = isOnSale && salePrice != null && origPrice != null && origPrice > salePrice;
              return (
                <ProductCardLink
                  key={product.id}
                  href={`/products/${product.public_id ? productSlug({ slug: product.slug, public_id: product.public_id }) : product.slug}`}
                  className="group flex flex-col"
                >
                  {/* Image + overlay badges */}
                  <div className="relative overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-900">
                    <ProductCardImage images={product.images ?? []} name={product.name} />
                    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                      {isSold && (
                        <div className="self-start bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-medium tracking-widest uppercase px-2.5 py-1 rounded-full">
                          Sold
                        </div>
                      )}
                      {!isSold && isOnSale && (
                        <div className="self-start flex items-center gap-1.5">
                          <div className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-semibold tracking-wide px-2.5 py-1">
                            Sale
                          </div>
                          {product.show_price && origPrice != null && salePrice != null && (
                            <div className="bg-amber-500/90 backdrop-blur-sm text-white text-[10px] sm:text-xs font-semibold tracking-wide px-2.5 py-1 rounded-full">
                              −{Math.round((1 - salePrice / origPrice) * 100)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className={`px-1 pt-3 pb-3 flex flex-col gap-1 ${isSold ? "opacity-60" : ""}`}>
                    {/* Category + tier */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                        {getCategoryLabel(product.category ?? "")}
                      </span>
                      {(product.tier ?? []).length > 0 && (
                        <>
                          <span className="text-[10px] sm:text-xs text-gray-400">·</span>
                          <span className="text-[10px] sm:text-xs text-gray-400 italic">{(product.tier ?? []).join(" · ")}</span>
                        </>
                      )}
                    </div>
                    {/* Name */}
                    <p className="text-sm sm:text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {product.name}
                    </p>
                    {/* Price row */}
                    <div className="mt-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                      {(() => {
                        if (!product.show_price || displayPrice == null) return <span />;
                        if (requiresInquiry(displayPrice)) {
                          return <span className="text-sm text-emerald-600 dark:text-emerald-400">Inquire for Pricing</span>;
                        }
                        if (hasSale) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-sm sm:text-[15px] font-semibold text-amber-500 dark:text-amber-400">{fmt(salePrice!)}</span>
                              <span className="text-xs text-gray-400 line-through">{fmt(origPrice!)}</span>
                            </span>
                          );
                        }
                        if (isSold && salePrice != null && origPrice != null) {
                          return (
                            <span className="flex items-center gap-2">
                              <span className="text-sm sm:text-[15px] text-gray-400">{fmt(salePrice)}</span>
                              <span className="text-xs text-gray-300 dark:text-gray-600 line-through">{fmt(origPrice)}</span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-sm sm:text-[15px] font-semibold text-gray-800 dark:text-gray-200">{fmt(displayPrice)}</span>
                        );
                      })()}
                      {(product.size || product.origin) && (
                        <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 text-right shrink-0">
                          {product.size ? `${product.size}mm` : ""}
                          {product.size && product.origin ? " · " : ""}
                          {product.origin && (
                            <span className={product.origin === "Myanmar" ? "text-emerald-600 dark:text-emerald-400" : ""}>{product.origin}</span>
                          )}
                        </span>
                      )}
                    </div>
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
