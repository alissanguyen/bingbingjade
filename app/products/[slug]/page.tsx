import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { publicIdFromSlug, productSlug } from "@/lib/slug";
import { resolveImageUrls, resolveVideoUrls, resolveFirstImageUrl, isStoragePath } from "@/lib/storage";
import { ProductPageClient } from "./ProductPageClient";
import { BackToProductsLink } from "./BackToProductsLink";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";

interface Product {
  id: string;
  name: string;
  category: string;
  origin: string;
  images: string[];
  videos: string[] | null;
  color: string[] | null;
  tier: string[];
  size: number;
  size_detailed: (number | null)[] | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  description: string | null;
  blemishes: string | null;
  is_featured: boolean | null;
  is_published: boolean;
  quick_ship: boolean;
  status: string;
  slug: string;
  public_id: string;
}

interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  public_id: string;
  category: string;
  color: string[] | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  images: string[];
  thumbnailUrl: string | null;
  colorOverlap: number; // how many colors match, for sorting
}

interface ProductOptionRaw {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  sale_price_usd: number | null;
  images: string[];
  status: "available" | "sold";
  sort_order: number;
}

export const revalidate = 21600;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const publicId = publicIdFromSlug(slug);
  if (!publicId) return {};

  const { data: product } = await supabase
    .from("products")
    .select("name, category, origin, description, color, tier, price_display_usd, images")
    .eq("public_id", publicId)
    .single<{ name: string; category: string; origin: string | null; description: string | null; color: string[] | null; tier: string[] | null; price_display_usd: number | null; images: string[] }>();

  if (!product) return {};

  const ogImage = await resolveFirstImageUrl(product.images ?? []);

  const descParts: string[] = [];
  if (product.category) descParts.push(product.category.charAt(0).toUpperCase() + product.category.slice(1));
  if (product.color?.length) descParts.push(product.color.join(", "));
  if (product.tier?.length) descParts.push(product.tier.join(", "));
  if (product.price_display_usd != null) descParts.push(`$${product.price_display_usd}`);
  const fallbackDesc = descParts.length ? descParts.join(" · ") : "Authentic jade jewelry at BingBing Jade.";
  const description = product.description || fallbackDesc;

  const type = product.category ?? "";
  const colors = product.color ?? [];
  const tiers = product.tier ?? [];
  const origin = product.origin ?? "";

  const keywords: string[] = [
    // Base
    "jadeite",
    "natural jadeite",
    "Type A jade",
    "untreated jade",
    "authentic jade",
    "jade jewelry",
    "fine jade",
    // Type-specific
    ...(type ? [
      `jadeite ${type}`,
      `jadeite ${type} for sale`,
      `natural jade ${type}`,
      `Burmese jade ${type}`,
    ] : []),
    // Color-specific
    ...colors.map((c) => `${c} jade`),
    // Texture/tier-specific
    ...tiers.map((t) => `${t.toLowerCase()} jade`),
    // Origin-specific
    ...(origin ? [`${origin} jade`, `${origin} jade ${type}`.trim()] : []),
  ];

  return {
    title: product.name,
    description,
    keywords,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 1200, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const publicId = publicIdFromSlug(slug);
  if (!publicId) notFound();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, category, origin, images, videos, color, tier, size, size_detailed, price_display_usd, sale_price_usd, description, blemishes, is_featured, is_published, quick_ship, status, slug, public_id")
    .eq("public_id", publicId)
    .single<Product>();

  if (!product) notFound();

  // Draft products are only visible in development
  if (!product.is_published && process.env.NODE_ENV !== "development") notFound();

  // Redirect to canonical URL if slug prefix is wrong
  const canonical = productSlug(product);
  if (slug !== canonical) redirect(`/products/${canonical}`);

  // Resolve storage paths → signed URLs (no-op for legacy public URLs)
  const [productImages, productVideos] = await Promise.all([
    resolveImageUrls(product.images ?? []),
    resolveVideoUrls(product.videos ?? []),
  ]);

  // Fetch product options
  const { data: rawOptions } = await supabase
    .from("product_options")
    .select("id, label, size, price_usd, sale_price_usd, images, status, sort_order")
    .eq("product_id", product.id)
    .order("sort_order")
    .returns<ProductOptionRaw[]>();

  const optionsWithResolvedImages = await Promise.all(
    (rawOptions ?? []).map(async (opt) => {
      const imgs = opt.images ?? [];
      const resolved = imgs.some(isStoragePath) ? await resolveImageUrls(imgs) : imgs;
      return { ...opt, images: resolved };
    })
  );

  // Fetch related products: same category, exclude current, published only
  const currentColors = product.color ?? [];
  const { data: relatedRaw } = await supabase
    .from("products")
    .select("id, name, slug, public_id, category, color, price_display_usd, sale_price_usd, status, images")
    .eq("category", product.category)
    .eq("is_published", true)
    .neq("id", product.id)
    .limit(12);

  const relatedWithThumbnails: RelatedProduct[] = await Promise.all(
    (relatedRaw ?? []).map(async (p) => {
      const pColors = (p.color as string[] | null) ?? [];
      const overlap = pColors.filter((c) => currentColors.includes(c)).length;
      const thumbnailUrl = await resolveFirstImageUrl((p.images as string[]) ?? []);
      return {
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        public_id: p.public_id as string,
        category: p.category as string,
        color: p.color as string[] | null,
        price_display_usd: p.price_display_usd as number | null,
        sale_price_usd: p.sale_price_usd as number | null,
        status: p.status as string,
        images: (p.images as string[]) ?? [],
        thumbnailUrl,
        colorOverlap: overlap,
      };
    })
  );

  // Sort: color-matching first, then by name; cap at 4
  const related = relatedWithThumbnails
    .sort((a, b) => b.colorOverlap - a.colorOverlap || a.name.localeCompare(b.name))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Back */}
      <BackToProductsLink />

      <ProductPageClient
        product={product}
        productImages={productImages}
        productVideos={productVideos}
        options={optionsWithResolvedImages}
      />

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6">
            You Might Also Like
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => {
              const slug = productSlug(p);
              const isSold = p.status === "sold";
              const displayPrice = p.sale_price_usd ?? p.price_display_usd;
              const needsInquiry = displayPrice != null && requiresInquiry(displayPrice);
              return (
                <Link
                  key={p.id}
                  href={`/products/${slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-sm"
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800">
                    {p.thumbnailUrl ? (
                      <Image
                        src={p.thumbnailUrl}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className={`object-cover transition duration-300 group-hover:scale-[1.03] ${isSold ? "opacity-60" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full bg-emerald-50 dark:bg-emerald-950/20" />
                    )}
                    {isSold && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">Sold</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {p.name}
                    </p>
                    <p className="mt-auto pt-2 text-xs text-gray-400 dark:text-gray-500">
                      {needsInquiry
                        ? obfuscatedPrice(displayPrice!)
                        : displayPrice != null
                        ? `$${displayPrice.toLocaleString()}`
                        : null}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
