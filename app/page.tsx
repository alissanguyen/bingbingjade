import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { FeaturedCarousel } from "@/app/components/FeaturedCarousel";
import { ReviewsCarousel } from "@/app/components/ReviewsCarousel";

const HERO_IMG = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
const JADE_IMG  = "https://images.unsplash.com/photo-1767040276964-d2a39a86b1d4?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default async function Home() {
  const { data: featuredProducts } = await supabase
    .from("products")
    .select("id, name, category, images, tier, price_display_usd, sale_price_usd, status")
    .eq("is_featured", true)
    .order("created_at", { ascending: false });

  return (
    <div className="bg-white dark:bg-gray-950">

      {/* ── Hero Banner ── */}
      <div className="relative w-full h-[72vh] min-h-120 overflow-hidden">
        <Image
          src={HERO_IMG}
          alt="Natural jadeite collection"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/20 to-black/60" />

        {/* Hero text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-4">
            Natural Jadeite
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight drop-shadow-lg max-w-3xl">
            Carefully Selected,<br />Each Piece Unique
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed">
            Type A jadeite from Myanmar and Guatemala — sourced for color, texture, and character.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/products"
              className="rounded-full bg-emerald-700 hover:bg-emerald-600 px-7 py-3 text-sm font-semibold text-white transition-colors shadow-lg"
            >
              Browse Collection
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/60 hover:border-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      {/* ── Featured Carousel ── */}
      <FeaturedCarousel products={featuredProducts ?? []} />

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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-6">
              Natural Jadeite,<br />Carefully Selected
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed text-[18px]">
              <p>
                Each piece in our collection is individually sourced and selected for its color, texture, and character. We specialize in natural Type A jadeite, focusing primarily on jade from Myanmar (Burmese) and select pieces from Guatemala.
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
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/30 to-transparent" />
          </div>
        </div>
      </div>

      {/* ── Closing quote ── */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-2xl sm:text-3xl font-light text-gray-700 dark:text-gray-300 leading-relaxed italic">
            &quot;Each piece tells its own story.
          </p>
          <p className="text-2xl sm:text-3xl font-light text-emerald-700 dark:text-emerald-400 leading-relaxed italic mt-1">
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
