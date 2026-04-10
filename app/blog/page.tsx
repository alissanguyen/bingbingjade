import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { client } from "@/lib/sanity/client";
import { urlFor } from "@/lib/sanity/image";
import { postsQuery } from "@/lib/sanity/queries";

export const metadata: Metadata = {
  title: "Blog — The BingBing Jade Educational Corner",
  description: "Educational articles, jade guides, and collector insights from BingBing Jade.",
};

export const revalidate = 3600;

type Post = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  publishedAt: string;
  featured?: boolean;
  heroImage?: { asset: unknown; alt?: string };
  author?: { name: string; slug: string };
  categories?: { title: string; slug: string }[];
};

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  const posts: Post[] = await client.fetch(postsQuery);

  const featured = posts.find((p) => p.featured) ?? posts[0] ?? null;
  const rest = posts.filter((p) => p._id !== featured?._id);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">

        {/* Page header */}
        <div className="mb-12 text-center">
          <p className="text-[14px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-3">
            From the Studio
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            The BingBing Jade Educational Blog
          </h1>
          <p className="max-w-xl mx-auto text-[15px] sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed">
            Guides, collector insights, and stories about natural jadeite from BingBing Jade.
          </p>
        </div>

        {/* Featured post */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block mb-14 overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition hover:border-emerald-200 dark:hover:border-emerald-800"
          >
            <div className="grid sm:grid-cols-2 gap-0">
              {featured.heroImage?.asset ? (
                <div className="relative aspect-4/3 sm:aspect-auto sm:min-h-95">
                  <Image
                    src={urlFor(featured.heroImage.asset).width(1000).height(700).quality(85).url()}
                    alt={featured.heroImage.alt ?? featured.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="aspect-4/3 sm:aspect-auto sm:min-h-95 bg-emerald-50 dark:bg-emerald-950/30" />
              )}

              <div className="flex flex-col justify-center px-4 py-6 sm:px-10 sm:py-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-block rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    Featured
                  </span>
                  {featured.categories?.[0] && (
                    <span className="text-[12px] sm:text-xs text-gray-400 dark:text-gray-500">
                      {featured.categories[0].title}
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {featured.title}
                </h2>

                {featured.excerpt && (
                  <p className="text-[15px] sm:text-base text-gray-500 dark:text-gray-400 leading-relaxed mb-6 line-clamp-3">
                    {featured.excerpt}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[12px] sm:text-sm text-gray-400 dark:text-gray-500">
                  {featured.author && (
                    <>
                      <span>{featured.author.name}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{fmtDate(featured.publishedAt)}</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Post grid */}
        {rest.length > 0 && (
          <>
            {featured && (
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-6">
                More Articles
              </h2>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link
                  key={post._id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-sm"
                >
                  {post.heroImage?.asset ? (
                    <div className="relative aspect-[16/9] w-full overflow-hidden">
                      <Image
                        src={urlFor(post.heroImage.asset).width(700).height(400).quality(80).url()}
                        alt={post.heroImage.alt ?? post.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-emerald-50 dark:bg-emerald-950/20" />
                  )}

                  <div className="flex flex-col flex-1 p-5">
                    {post.categories && post.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.categories.map((cat) => (
                          <span
                            key={cat.slug}
                            className="rounded-full bg-emerald-100 dark:bg-green-400/30 px-2.5 py-0.5 text-[11px] sm:text-[17px] font-medium text-green-600 dark:text-green-400"
                          >
                            {cat.title}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 className="text-[16px] sm:text-base font-semibold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      <p className="text-[13px] sm:text-sm leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-4 text-[12px] sm:text-xs text-gray-400 dark:text-gray-500">
                      {post.author && (
                        <>
                          <span>{post.author.name}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{fmtDate(post.publishedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {posts.length === 0 && (
          <div className="text-center py-24 text-gray-400 dark:text-gray-600">
            <p className="text-lg">No articles published yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
