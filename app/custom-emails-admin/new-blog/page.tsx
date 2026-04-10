import { client } from "@/lib/sanity/client";
import { urlFor } from "@/lib/sanity/image";
import { postsQuery } from "@/lib/sanity/queries";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NewBlogClient, type BlogPost, type PickerSubscriber } from "./NewBlogClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");

export default async function NewBlogPage() {
  const [rawPosts, { data: subs }, { count }] = await Promise.all([
    client.fetch(postsQuery),
    supabaseAdmin
      .from("email_subscribers")
      .select("id, email, subscribed_at")
      .order("subscribed_at", { ascending: false }),
    supabaseAdmin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true }),
  ]);

  const posts: BlogPost[] = (rawPosts ?? []).map((p: {
    _id: string; title: string; slug: string; excerpt?: string;
    publishedAt?: string; heroImage?: { asset: unknown; alt?: string };
    categories?: { title: string }[];
  }) => ({
    id: p._id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? null,
    publishedAt: p.publishedAt ?? null,
    imageUrl: p.heroImage?.asset
      ? urlFor(p.heroImage.asset).width(600).height(280).quality(80).url()
      : null,
    category: p.categories?.[0]?.title ?? null,
    postUrl: `${SITE_URL}/blog/${p.slug}`,
  }));

  return (
    <NewBlogClient
      posts={posts}
      subscribers={(subs ?? []) as PickerSubscriber[]}
      subscriberCount={count ?? 0}
    />
  );
}
