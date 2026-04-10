import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { client } from "@/lib/sanity/client";
import { urlFor } from "@/lib/sanity/image";
import { postsQuery, postBySlugQuery } from "@/lib/sanity/queries";
import { PortableTextRenderer } from "@/app/components/sanity/PortableTextRenderer";

export const revalidate = 3600;

type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt: string;
  heroImage?: { asset: unknown; alt?: string; caption?: string };
  body?: unknown[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: { asset: unknown; alt?: string };
    canonicalUrl?: string;
    noIndex?: boolean;
  };
  author?: {
    name: string;
    slug: string;
    image?: { asset: unknown; alt?: string };
    bio?: unknown[];
  };
  categories?: { title: string; slug: string }[];
  relatedProducts?: {
    _id: string;
    title: string;
    slug: string;
    price?: number;
    thumbnail?: { asset: unknown; alt?: string };
  }[];
  relatedPosts?: {
    _id: string;
    title: string;
    slug: string;
    excerpt?: string;
    publishedAt: string;
    heroImage?: { asset: unknown; alt?: string };
    categories?: { title: string; slug: string }[];
  }[];
  sources?: { label: string; url: string }[];
};

export async function generateStaticParams() {
  const posts: { slug: string }[] = await client.fetch(postsQuery);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post: Post | null = await client.fetch(postBySlugQuery, { slug });
  if (!post) return {};

  const title = post.seo?.metaTitle ?? post.title;
  const description = post.seo?.metaDescription ?? post.excerpt;
  const ogImage = post.seo?.ogImage?.asset ?? post.heroImage?.asset;

  return {
    title: `${title} — BingBing Jade`,
    description,
    ...(post.seo?.noIndex ? { robots: { index: false } } : {}),
    ...(post.seo?.canonicalUrl ? { alternates: { canonical: post.seo.canonicalUrl } } : {}),
    openGraph: ogImage
      ? {
          images: [{ url: urlFor(ogImage).width(1200).height(630).quality(85).url() }],
        }
      : undefined,
  };
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post: Post | null = await client.fetch(postBySlugQuery, { slug });
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* Back link */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          The Jade Blog
        </Link>
      </div>

      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-10">

        {/* Categories */}
        {post.categories && post.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.categories.map((cat) => (
              <span
                key={cat.slug}
                className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
              >
                {cat.title}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white leading-snug mb-4">
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg leading-relaxed text-gray-500 dark:text-gray-400 mb-6">
            {post.excerpt}
          </p>
        )}

        {/* Author + date row */}
        <div className="flex items-center gap-3 pb-8 border-b border-gray-100 dark:border-gray-800">
          {post.author?.image?.asset != null && (
            <Image
              src={urlFor(post.author.image.asset).width(80).height(80).quality(85).url()}
              alt={post.author.image.alt ?? post.author.name}
              width={36}
              height={36}
              className="rounded-full object-cover w-9 h-9"
            />
          )}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {post.author && (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {post.author.name}
              </span>
            )}
            {post.author && <span className="mx-2">·</span>}
            <span>{fmtDate(post.publishedAt)}</span>
          </div>
        </div>

        {/* Hero image */}
        {post.heroImage?.asset != null && (
          <figure className="mt-8 -mx-4 sm:mx-0">
            <Image
              src={urlFor(post.heroImage.asset).width(1400).height(800).quality(85).url()}
              alt={post.heroImage.alt ?? post.title}
              width={1400}
              height={800}
              className="w-full sm:rounded-2xl object-cover"
              priority
            />
            {post.heroImage.caption && (
              <figcaption className="mt-3 text-center text-sm text-gray-400 dark:text-gray-500 italic">
                {post.heroImage.caption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Body */}
        <div className="mt-10 space-y-0">
          <PortableTextRenderer value={(post.body ?? []) as Parameters<typeof PortableTextRenderer>[0]["value"]} />
        </div>

        {/* Sources */}
        {post.sources && post.sources.length > 0 && (
          <section className="mt-14 pt-8 border-t border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
              References
            </h2>
            <ol className="space-y-2 list-decimal list-inside">
              {post.sources.map((source, i) => (
                <li key={`${source.url}-${i}`} className="text-sm text-gray-500 dark:text-gray-400">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 underline underline-offset-4 hover:text-emerald-600 dark:hover:text-emerald-300"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Author bio */}
        {post.author && (
          <section className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-4">
              {post.author.image?.asset != null && (
                <Image
                  src={urlFor(post.author.image.asset).width(120).height(120).quality(85).url()}
                  alt={post.author.image.alt ?? post.author.name}
                  width={56}
                  height={56}
                  className="rounded-full object-cover w-14 h-14 shrink-0"
                />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
                  Written by
                </p>
                <p className="font-semibold text-gray-900 dark:text-white mb-1">
                  {post.author.name}
                </p>
                {post.author.bio && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed [&_p]:my-1">
                    <PortableTextRenderer value={post.author.bio as Parameters<typeof PortableTextRenderer>[0]["value"]} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </article>

      {/* Recommended posts */}
      {post.relatedPosts && post.relatedPosts.length > 0 && (
        <section className="border-t border-gray-100 dark:border-gray-800 py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6">
              Continue Reading
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {post.relatedPosts.map((p) => (
                <Link
                  key={p._id}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition hover:border-emerald-200 dark:hover:border-emerald-800"
                >
                  {p.heroImage?.asset ? (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image
                        src={urlFor(p.heroImage.asset).width(600).height(340).quality(80).url()}
                        alt={p.heroImage.alt ?? p.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-emerald-50 dark:bg-emerald-950/20" />
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    {p.categories?.[0] && (
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                        {p.categories[0].title}
                      </span>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-auto pt-2">
                      {fmtDate(p.publishedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related products */}
      {post.relatedProducts && post.relatedProducts.length > 0 && (
        <section className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 py-14">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6">
              Featured Pieces
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {post.relatedProducts.map((product) => (
                <Link
                  key={product._id}
                  href={`/products/${product.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 transition hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm"
                >
                  {product.thumbnail?.asset ? (
                    <Image
                      src={urlFor(product.thumbnail.asset).width(120).height(120).quality(80).url()}
                      alt={product.thumbnail.alt ?? product.title}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {product.title}
                    </p>
                    {typeof product.price === "number" && (
                      <p className="text-xs text-gray-400 mt-0.5">${product.price.toFixed(2)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to journal */}
      <div className="py-12 text-center">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-6 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          ← Back to Blog page
        </Link>
      </div>
    </div>
  );
}
