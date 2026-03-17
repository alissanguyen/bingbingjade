import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generates a short stable public ID, e.g. "x3k92qab" */
export function generatePublicId(): string {
  return nanoid();
}

/** Builds the URL segment: "{slug}-{public_id}" e.g. "icy-green-jade-bangle-56mm-a3f2b891" */
export function productSlug(product: { slug: string; public_id: string }): string {
  return `${product.slug}-${product.public_id}`;
}

/** Extracts the public_id from the end of a slug param (last hyphen-separated segment) */
export function publicIdFromSlug(slug: string): string | null {
  const idx = slug.lastIndexOf("-");
  if (idx === -1) return slug.length > 0 ? slug : null;
  return slug.slice(idx + 1) || null;
}
