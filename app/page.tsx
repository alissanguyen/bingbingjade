export const revalidate = 120;

import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { FeaturedCarousel } from "@/app/components/FeaturedCarousel";
import { ReviewsCarousel } from "@/app/components/ReviewsCarousel";
import { SubscribePopup } from "@/app/components/SubscribePopup";
import { GalleryGrid } from "@/app/components/GalleryGrid";

export const metadata: Metadata = {
  title: "BingBing Jade | Natural Type A Jadeite Jewelry with Certification | US Based",
  description:
    "100% natural Type A jadeite jewelry — no dye, no heat, no polymer. Lifetime guarantee Jadeite Type A. Shop bangles, bracelets, rings, pendants, and more with confidence. Support our small business, minority and women owned (MWBEs).",
  keywords: [
    "jadeite jewelry",
    "natural jadeite",
    "Type A jade",
    "Burmese jade",
    "jade bangles",
    "jade bracelets",
    "jade rings",
    "jade pendants",
    "authentic jade",
    "certified jadeite",
    "untreated jade",
    "fine jade jewelry",
    "luxury jade",
    "icy jade",
    "glassy jade",
    "translucent jade",
    "green jade jewelry",
    "jadeite bangle USA",
    "buy jadeite jewelry",
    "jade shop online",
  ],
};

const HERO_IMG = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
const JADE_IMG = "https://images.unsplash.com/photo-1767040276964-d2a39a86b1d4?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const getCachedFeaturedProducts = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, category, images, tier, price_display_usd, sale_price_usd, is_clearance, status, slug, public_id, size, origin")
      .eq("is_featured", true)
      .order("created_at", { ascending: false });

    return data ?? [];
  },
  ["home-featured-products-v1"],
  { revalidate: 120 }
);

export default async function Home() {
  const rawFeatured = await getCachedFeaturedProducts();
  const featuredProducts = rawFeatured.map((p) => ({
    ...p,
    images: (p.images ?? []).slice(0, 2).filter(Boolean),
  }));

  return (
    <div className="bg-white dark:bg-gray-950">
      <SubscribePopup />
      <h1 className="sr-only">BingBing Jade — Certified Natural Type A Jadeite Jewelry. No dye, no heat, no polymer treatment. Shop authentic jade bangles, bracelets, rings, and pendants with transparent pricing.</h1>

      {/* ── Hero Banner ── */}
      <div className="relative w-full h-[72vh] min-h-120 overflow-hidden">
        <Image
          src={HERO_IMG}
          alt="Natural jadeite collection"
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/20 to-black/60" />

        {/* Hero text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 mt-6 sm:mt-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-4">
            Natural Jadeite
          </p>
          <h1 className="text-3xl sm:text-6xl font-bold text-white leading-tight tracking-tight drop-shadow-lg max-w-3xl">
            Carefully Selected,<br />Each Piece Unique
          </h1>
          <p className="mt-5 text-sm sm:text-lg text-white/80 max-w-xl leading-relaxed">
            Certified natural Grade A jadeite — Carefully sourced, transparently priced, and backed by real expertise—so you know exactly what you’re buying.
          </p>
          <p className="mt-5 text-sm sm:text-lg text-white/80 max-w-xl leading-relaxed">
            From luminous bangles to delicate pendants, we focus on quality you can trust and pricing that reflects true value.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">

            <Link
              href="/products?shipping=ship_now"
              className="rounded-full bg-emerald-700 hover:bg-emerald-600 px-7 py-3 text-sm font-semibold text-white transition-colors shadow-lg"
            >
              Shop US Inventory

            </Link>

            <Link
              href="/products"
              className="rounded-full border border-white/60 hover:border-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white transition-colors"
            >
              Explore All Pieces
            </Link>
          </div>
          <span className="font-medium italic text-[14px] mt-3 text-green-300">Ready-to-ship US inventory alongside curated sourced pieces.</span>
        </div>
      </div>
      {/* ── Why BingBing Jade ── */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image — left */}
          <div className="relative rounded-2xl overflow-hidden aspect-square shadow-2xl">
            <Image
              src="/homepage3.jpg"
              alt="Jade pieces up close"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
          </div>
          {/* Text — right */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-3">
              Why BingBing Jade
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Authenticity You Can Trust
            </h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-[15px] sm:text-[18px] mb-8">
              BingBing Jade offers authentic, untreated Type A jadeite jewelry — carefully sourced and transparently priced. Every piece is free from dye, heat, or polymer treatment, with certification available for added assurance. From luminous bangles to delicate pendants, we focus on quality you can trust and pricing that reflects true value.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "Authenticity guaranteed — 100% Natural Grade A Jadeite",
                "Certificate included with every piece",
                "Real photos & videos — what you see is what you get",
                "Transparent, competitive pricing, sourced from trusted vendors",
                "US-based support",
                "Questions? We walk you through every piece before you buy",
              ].map((point) => (
                <li key={point} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-[12px] sm:text-[18px]">
                  <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {/* ── Featured Carousel ── */}
      <FeaturedCarousel products={featuredProducts} />

      {/* ── Reviews Carousel ── */}
      <ReviewsCarousel />

      {/* ── About section ── */}
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Text */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-4">
              Our Philosophy
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-6">
              Natural Jadeite,<br />Carefully Selected
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed text-[17px] sm:text-[18px]">
              <p>
                Each piece in our collection is individually sourced and selected for its color, texture, and character. From raw materials to a completed bangle, we specialize in natural Type A jadeite, focusing primarily on jade from Myanmar (Burmese) and select pieces from Guatemala.
              </p>
              <p>
                Jade is not simply a gemstone — it is a material shaped by nature over millions of years. Every bangle, bracelet, and carving carries its own pattern, translucency, and subtle variations that make it completely unique.
              </p>
              <p>
                Rather than offering mass-produced inventory, our collection is curated in small quantities. New pieces are added regularly as we discover jade that meets our standards for beauty, quality, and authenticity.
              </p>
              <p>
                Whether you are beginning your jade journey or expanding an existing collection, we hope each piece here invites you to look closer and appreciate the quiet depth that only natural jadeite can offer.
              </p>
            </div>
            <Link
              href="/products"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition-colors"
            >
              View Our Selection
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          {/* Image */}
          <div className="relative rounded-2xl overflow-hidden aspect-4/5 shadow-2xl">
            <Image
              src={JADE_IMG}
              alt="Jade pieces up close"
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
          </div>
        </div>
      </div>



      {/* ── Gallery ── */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">Studio Shots</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">A Closer Look</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">Created to give a closer, more accurate view of jade’s true color and character. A glimpse into pieces we’ve sourced — many already found their homes.</p>
        </div>
        <GalleryGrid />
        <div className="text-center mt-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-6 py-2.5 text-sm font-medium transition-colors"
          >
            View All Pieces
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Closing quote ── */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-2xl sm:text-3xl font-normal text-gray-700 dark:text-gray-300 leading-relaxed italic">
            &quot;Each piece tells its own story.
          </p>
          <p className="text-2xl sm:text-3xl font-normal text-emerald-700 dark:text-emerald-400 leading-relaxed italic mt-1">
            Some will speak to you immediately.&quot;
          </p>
          <Link
            href="/products"
            className="mt-8 inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Explore the collection →
          </Link>
        </div>
      </div>

    </div>
  );
}
