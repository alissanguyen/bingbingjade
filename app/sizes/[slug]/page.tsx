import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductListing, type ProductSearchParams } from "@/app/products/page";
import { SIZE_FILTERS, curatedFilterToSearchParams } from "@/lib/curated-routes";

export const revalidate = 120;

const SITE_URL = "https://bingbingjade.com";

type Params = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<ProductSearchParams>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const size = SIZE_FILTERS[slug];
  if (!size) return { title: "Bangle Size Edit — BingBing Jade" };

  return {
    title: `${size.title} — BingBing Jade`,
    description: size.description,
    alternates: { canonical: size.href },
    openGraph: {
      title: `${size.title} — BingBing Jade`,
      description: size.description,
      url: `${SITE_URL}${size.href}`,
      type: "website",
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: size.title }],
    },
  };
}

export default async function SizePage({ params, searchParams = Promise.resolve({}) }: Params) {
  const { slug } = await params;
  const size = SIZE_FILTERS[slug];
  if (!size) notFound();

  return (
    <ProductListing
      searchParams={searchParams}
      baseParams={curatedFilterToSearchParams(size.filters)}
      pathname={size.href}
      intro={{
        eyebrow: size.eyebrow,
        title: size.title,
        description: size.description,
        breadcrumbs: [
          { label: "Home", href: "/" },
          { label: "Sizes", href: "/size-guide" },
          { label: size.title },
        ],
      }}
    />
  );
}
