import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { publicIdFromSlug, productSlug } from "@/lib/slug";
import { resolveImageUrls, resolveVideoUrls, resolveFirstImageUrl, isStoragePath } from "@/lib/storage";
import { ProductPageClient } from "./ProductPageClient";
import { BackToProductsLink } from "./BackToProductsLink";
import { RelatedProductsCarousel } from "../RelatedProductsCarousel";


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

      {/* Quality assurance strip */}
      <div className="my-16 border-t border-gray-100 dark:border-gray-800 pt-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Image */}
        <div className="overflow-hidden rounded-2xl aspect-4/5 bg-gray-100 dark:bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gallery/IMG_5466.jpg"
            alt="Natural jadeite sourcing and quality inspection"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Text */}
        <div className="space-y-4 px-2 md:px-6">
          <p className="text-[14px] sm:text-[16px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">A Different Standard of Jade</p>
          <div className="w-8 h-px bg-gray-300 dark:bg-gray-700" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            Type A Jadeite — No dye, no treatment. No compromise.
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Every piece you see here earned its place.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            We don’t list everything we source — only what is worth your attention. Our team reviews a high volume of jade daily, selecting pieces based on
            structure, color, clarity, and overall presence. Only a small fraction
            meets the standard we’re willing to stand behind.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            In a market where pricing and quality are often inconsistent, we take
            a different approach: we offer pieces that justify their place — in both
            what they are and how they are valued.
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            If you don’t see the exact piece you’re looking for, we can source beyond what’s shown.
          </p>
          <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
            We show less — so you choose better.
          </p>
        </div>
      </div>

      <RelatedProductsCarousel products={related} />
    </div>
  );
}
