import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrls, resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { categoryLabel, categoryEmoji } from "@/lib/campaign-categories";
import { ProductCardImage } from "@/app/products/ProductCardImage";
import { ProductCardLink } from "@/app/products/ProductCardLink";

export const dynamic = "force-dynamic";

interface CampaignProduct {
  id: string;
  product_id: string;
  event_price_usd: number | null;
  sort_order: number;
  is_featured_for_email: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    public_id: string;
    category: string;
    origin: string;
    color: string[] | null;
    size: number | null;
    images: string[];
    price_display_usd: number | null;
    sale_price_usd: number | null;
    show_price: boolean;
    status: string;
    quick_ship: boolean;
    is_published: boolean;
  };
  cardImages: string[];
  resolvedEventPrice: number | null;
}

/** Compute the best event price for display */
function computeEventPrice(
  basePriceUsd: number | null,
  eventPriceUsd: number | null,
  discountType: string | null,
  discountValue: number | null
): number | null {
  if (eventPriceUsd != null) return eventPriceUsd;
  if (!basePriceUsd || !discountType || discountValue == null) return null;
  if (discountType === "percent") return Math.max(0, basePriceUsd * (1 - discountValue / 100));
  if (discountType === "fixed") return Math.max(0, basePriceUsd - discountValue);
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: campaign } = await supabase
    .from("campaign_events")
    .select("name, description, category")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!campaign) return {};

  return {
    title: campaign.name,
    description: campaign.description ?? `Shop the ${campaign.name} collection at BingBing Jade.`,
  };
}

export default async function SalePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Check auth for draft campaigns
  const session = await getSessionUser();
  const admin = isAdmin(session);

  // Fetch campaign (admin can see draft, public can only see active)
  const query = supabaseAdmin
    .from("campaign_events")
    .select("*")
    .eq("slug", slug);

  if (!admin) {
    query.eq("status", "active");
  }

  const { data: campaign } = await query.single();

  if (!campaign) {
    if (admin) notFound(); // admin viewing invalid slug → 404
    // Non-admin: either doesn't exist or is draft → redirect to shop
    redirect("/products");
  }

  // Ended campaigns: show expired message (no redirect, admin can still preview)
  const isEnded = campaign.status === "ended";
  const isDraft = campaign.status === "draft";

  // Fetch campaign products with full product data
  const { data: rawProducts } = await supabaseAdmin
    .from("campaign_event_products")
    .select(`
      id, event_price_usd, sort_order, is_featured_for_email, product_id,
      products!inner (
        id, name, slug, public_id, category, origin, color, size,
        images, price_display_usd, sale_price_usd, show_price,
        status, quick_ship, is_published
      )
    `)
    .eq("campaign_id", campaign.id)
    .order("sort_order")
    .order("created_at");

  // Resolve images and filter to published, non-sold products
  const resolvedProducts = (
    await Promise.all(
      (rawProducts ?? []).map(async (cp) => {
        const p = cp.products as unknown as CampaignProduct["product"];
        if (!p.is_published || p.status === "sold" || p.status === "archived") return null;

        const cardImages = await resolveImageUrls((p.images ?? []).slice(0, 2));
        const eventPrice = computeEventPrice(
          p.price_display_usd,
          cp.event_price_usd as number | null,
          campaign.discount_type,
          campaign.discount_value
        );

        return {
          id: cp.id as string,
          product_id: cp.product_id as string,
          event_price_usd: cp.event_price_usd as number | null,
          sort_order: cp.sort_order as number,
          is_featured_for_email: cp.is_featured_for_email as boolean,
          product: { ...p, slug: p.slug, public_id: p.public_id },
          cardImages,
          resolvedEventPrice: eventPrice,
        } as CampaignProduct;
      })
    )
  ).filter(Boolean) as CampaignProduct[];

  // Fisher-Yates shuffle — new random order on every page load
  const products = [...resolvedProducts];
  for (let i = products.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [products[i], products[j]] = [products[j], products[i]];
  }

  const hasDiscount = campaign.discount_type && campaign.discount_value != null;
  const discountLabel = hasDiscount
    ? campaign.discount_type === "percent"
      ? `${campaign.discount_value}% off`
      : `$${campaign.discount_value} off`
    : null;

  const dateRange = (() => {
    const s = campaign.starts_at ? new Date(campaign.starts_at) : null;
    const e = campaign.ends_at ? new Date(campaign.ends_at) : null;
    if (s && e) return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
    if (e) return `Until ${e.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
    return null;
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Admin preview banner */}
      {isDraft && admin && (
        <div className="bg-amber-500 text-white text-xs font-semibold text-center py-2 px-4">
          Preview — This campaign is in Draft and not visible to the public
          {" · "}
          <Link href={`/campaigns-admin/${campaign.id}`} className="underline">Manage Campaign</Link>
        </div>
      )}

      {/* Hero */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
          <div className="flex items-start gap-4">
            <span className="text-4xl sm:text-5xl">{categoryEmoji(campaign.category)}</span>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">
                {categoryLabel(campaign.category)}
                {dateRange && ` · ${dateRange}`}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">{campaign.description}</p>
              )}
              {campaign.banner_message && (
                <p className="mt-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest">{campaign.banner_message}</p>
              )}
              {discountLabel && !isEnded && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{discountLabel} on all event items</span>
                  {campaign.coupon_code && (
                    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-500">· code: {campaign.coupon_code}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ended state */}
      {isEnded ? (
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">This event has ended.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Browse our full collection for available pieces.</p>
          <Link href="/products" className="inline-flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium transition-colors">
            Shop All Products
          </Link>
        </div>
      ) : products.length === 0 ? (
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <p className="text-sm text-gray-400">No products added to this campaign yet.</p>
          {admin && (
            <Link href={`/campaigns-admin/${campaign.id}`} className="mt-4 inline-block text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              Add products →
            </Link>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
            {products.map((cp, i) => {
              const p = cp.product;
              const href = `/products/${productSlug(p)}`;
              const showOriginal = cp.resolvedEventPrice != null && p.show_price && p.price_display_usd != null;
              const displayPrice = cp.resolvedEventPrice ?? (p.show_price ? (p.sale_price_usd ?? p.price_display_usd) : null);

              return (
                <ProductCardLink
                  key={cp.id}
                  href={href}
                  className="group flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all"
                >
                  <ProductCardImage images={cp.cardImages} name={p.name} priority={i < 4}>
                    {/* Status badges */}
                    {p.status === "on_sale" && !cp.resolvedEventPrice && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-rose-500 text-white text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5">Sale</div>
                    )}
                    {cp.resolvedEventPrice != null && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-emerald-600 text-white text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5">
                        {campaign.name}
                      </div>
                    )}
                    {p.quick_ship && (
                      <div className="absolute top-2 right-2 z-10 rounded-full bg-sky-500 text-white text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5">Ship Now</div>
                    )}
                  </ProductCardImage>

                  <div className="p-3 flex-1 flex flex-col">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-0.5">
                      {p.category}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">{p.name}</p>

                    {/* Price display */}
                    {displayPrice != null && (
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          ${displayPrice.toFixed(0)}
                        </span>
                        {showOriginal && p.price_display_usd !== displayPrice && (
                          <span className="text-xs text-gray-400 line-through">
                            ${p.price_display_usd!.toFixed(0)}
                          </span>
                        )}
                      </div>
                    )}
                    {displayPrice == null && !p.show_price && (
                      <p className="mt-2 text-xs text-gray-400 italic">Inquire for pricing</p>
                    )}
                  </div>
                </ProductCardLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
