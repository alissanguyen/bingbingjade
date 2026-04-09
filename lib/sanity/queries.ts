import { groq } from "next-sanity";

export const postsQuery = groq`
  *[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    excerpt,
    publishedAt,
    featured,
    heroImage{
      asset,
      alt,
      caption
    },
    seo{
      metaTitle,
      metaDescription
    },
    author->{
      name,
      slug
    },
    categories[]->{
      title,
      "slug": slug.current
    }
  }
`;

export const postBySlugQuery = groq`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    excerpt,
    publishedAt,
    featured,
    heroImage{
      asset,
      alt,
      caption
    },
    body[]{
      ...,
      _type == "articleImage" => {
        ...,
        asset
      },
      _type == "productReference" => {
        ...,
        product->{
          _id,
          title,
          "slug": slug.current,
          price,
          thumbnail{
            asset,
            alt
          }
        }
      }
    },
    seo{
      metaTitle,
      metaDescription,
      canonicalUrl,
      noIndex,
      ogImage{
        asset,
        alt
      }
    },
    author->{
      name,
      slug,
      image{
        asset,
        alt
      },
      bio
    },
    categories[]->{
      title,
      "slug": slug.current
    },
    relatedProducts[]->{
      _id,
      title,
      "slug": slug.current,
      price,
      thumbnail{
        asset,
        alt
      }
    },
    sources[],
    relatedPosts[]->{
      _id,
      title,
      "slug": slug.current,
      excerpt,
      publishedAt,
      heroImage{
        asset,
        alt
      },
      categories[]->{
        title,
        "slug": slug.current
      }
    }
  }
`;
