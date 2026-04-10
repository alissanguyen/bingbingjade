import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { publicIdFromSlug, productSlug } from "@/lib/slug";
import { resolveImageUrls, resolveVideoUrls, resolveFirstImageUrl, isStoragePath } from "@/lib/storage";
import { ProductPageClient } from "./ProductPageClient";
import { BackToProductsLink } from "./BackToProductsLink";
import { ProductCardImage } from "../ProductCardImage";
import { ProductCardLink } from "../ProductCardLink";
import { getCategoryLabel } from "../categories";
import { obfuscatedPrice, requiresInquiry } from "@/lib/price";

function fmtCardPrice(price: number): string {
  return requiresInquiry(price) ? obfuscatedPrice(price) : `$${price.toFixed(2)}`;
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

const ORIGIN_TEXT: Record<string, string> = {
  Myanmar:   "text-emerald-600 dark:text-emerald-400",
  Guatemala: "text-blue-600 dark:text-blue-400",
  Hetian:    "text-fuchsia-600 dark:text-fuchsia-400",
};

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
  origin: string;
  color: string[] | null;
  tier: string[] | null;
  size: number | null;
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  quick_ship: boolean;
  cardImages: string[]; // first 2 resolved URLs for card hover effect
  colorOverlap: number;
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
    .select("id, name, slug, public_id, category, origin, color, tier, size, price_display_usd, sale_price_usd, status, quick_ship, images")
    .eq("category", product.category)
    .eq("is_published", true)
    .neq("id", product.id)
    .limit(12);

  const relatedResolved: RelatedProduct[] = await Promise.all(
    (relatedRaw ?? []).map(async (p) => {
      const imgs = (p.images as string[]) ?? [];
      const pColors = (p.color as string[] | null) ?? [];
      const overlap = pColors.filter((c) => currentColors.includes(c)).length;
      // Resolve up to 2 images for the card hover slide effect
      const firstTwo = imgs.slice(0, 2);
      const resolvedTwo = firstTwo.some(isStoragePath) ? await resolveImageUrls(firstTwo) : firstTwo;
      return {
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        public_id: p.public_id as string,
        category: p.category as string,
        origin: (p.origin as string) ?? "",
        color: p.color as string[] | null,
        tier: p.tier as string[] | null,
        size: p.size as number | null,
        price_display_usd: p.price_display_usd as number | null,
        sale_price_usd: p.sale_price_usd as number | null,
        status: p.status as string,
        quick_ship: (p.quick_ship as boolean) ?? false,
        cardImages: resolvedTwo,
        colorOverlap: overlap,
      };
    })
  );

  // Sort: color-matching first, then by name; cap at 4
  const related = relatedResolved
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            {related.map((p) => {
              const cardSlug = productSlug(p);
              const isSold = p.status === "sold";
              const isOnSale = p.status === "on_sale";
              const colors = (p.color ?? []).filter((c) => c && c.trim());
              const tiers = (p.tier ?? []);
              const displayPrice = p.sale_price_usd ?? p.price_display_usd;
              return (
                <ProductCardLink
                  key={p.id}
                  href={`/products/${cardSlug}`}
                  className={`group rounded-2xl border overflow-hidden hover:shadow-lg transition-all block ${
                    isSold
                      ? "border-gray-300 dark:border-gray-700 bg-gray-900/20 dark:bg-gray-700"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700"
                  }`}
                >
                  <ProductCardImage images={p.cardImages} name={p.name}>
                    {isSold && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 bg-black text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                        Sold
                      </div>
                    )}
                    {isOnSale && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 sm:gap-1.5">
                        <div className="bg-amber-400 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                          On Sale
                        </div>
                        {p.price_display_usd != null && p.sale_price_usd != null && (
                          <div className="bg-orange-500 text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow">
                            −{Math.round((1 - p.sale_price_usd / p.price_display_usd) * 100)}%
                          </div>
                        )}
                      </div>
                    )}
                    {p.quick_ship && !isSold && (
                      <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 z-10">
                        <div
                          className="flex items-center gap-1 sm:gap-1.5 bg-sky-950 border border-sky-400/60 text-sky-300 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                          style={{ boxShadow: "0 0 8px 1px rgba(56,189,248,0.35)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,0.8)]" />
                          Available Now
                        </div>
                      </div>
                    )}
                  </ProductCardImage>

                  {/* Info — desktop */}
                  <div className={`hidden sm:block p-4 ${isSold ? "opacity-80" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {getCategoryLabel(p.category)}
                      </span>
                      {tiers.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">· {tiers.join(" · ")}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{p.name}</h3>
                    {colors.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {colors.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`font-medium ${isSold ? "text-gray-500 dark:text-gray-400" : isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {displayPrice != null ? fmtCardPrice(displayPrice) : "Contact for price"}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                        {p.size ? `${p.size}mm` : ""}
                        {p.size && p.origin ? " · " : ""}
                        {p.origin && <span className={ORIGIN_TEXT[p.origin] ?? ""}>{p.origin}</span>}
                      </span>
                    </div>
                  </div>

                  {/* Info — mobile */}
                  <div className={`sm:hidden p-2.5 flex flex-col gap-0.5 ${isSold ? "opacity-80" : ""}`}>
                    <span className="text-[14px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {getCategoryLabel(p.category)}
                    </span>
                    {tiers.length > 0 && (
                      <span className="text-[13px] text-gray-400 dark:text-gray-500">{tiers.join(" · ")}</span>
                    )}
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">{p.name}</h3>
                    {colors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {colors.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_SWATCHES[c] ?? "bg-gray-300"}`} />
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1">
                      <span className={`text-xs font-medium ${isSold ? "text-gray-500 dark:text-gray-400" : isOnSale ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {displayPrice != null ? fmtCardPrice(displayPrice) : "Contact for price"}
                      </span>
                    </div>
                  </div>
                </ProductCardLink>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
