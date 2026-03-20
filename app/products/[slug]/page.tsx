import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { publicIdFromSlug, productSlug } from "@/lib/slug";
import { resolveImageUrls, resolveVideoUrls, resolveFirstImageUrl, isStoragePath } from "@/lib/storage";
import { ProductPageClient } from "./ProductPageClient";

interface Product {
  id: string;
  name: string;
  category: string;
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
  status: string;
  slug: string;
  public_id: string;
}

interface ProductOptionRaw {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
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
    .select("name, category, description, color, tier, price_display_usd, images")
    .eq("public_id", publicId)
    .single<{ name: string; category: string; description: string | null; color: string[] | null; tier: string[] | null; price_display_usd: number | null; images: string[] }>();

  if (!product) return {};

  const ogImage = await resolveFirstImageUrl(product.images ?? []);

  const descParts: string[] = [];
  if (product.category) descParts.push(product.category.charAt(0).toUpperCase() + product.category.slice(1));
  if (product.color?.length) descParts.push(product.color.join(", "));
  if (product.tier?.length) descParts.push(product.tier.join(", "));
  if (product.price_display_usd != null) descParts.push(`$${product.price_display_usd}`);
  const fallbackDesc = descParts.length ? descParts.join(" · ") : "Authentic jade jewelry at BingBing Jade.";
  const description = product.description || fallbackDesc;

  return {
    title: product.name,
    description,
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
    .select("id, name, category, images, videos, color, tier, size, size_detailed, price_display_usd, sale_price_usd, description, blemishes, is_featured, status, slug, public_id")
    .eq("public_id", publicId)
    .single<Product>();

  if (!product) notFound();

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
    .select("id, label, size, price_usd, images, status, sort_order")
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

      <ProductPageClient
        product={product}
        productImages={productImages}
        productVideos={productVideos}
        options={optionsWithResolvedImages}
      />
    </div>
  );
}
