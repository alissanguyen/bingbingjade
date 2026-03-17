export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productSlug(product: { id: string; name: string }): string {
  const namePart = slugify(product.name);
  const shortId = product.id.replace(/-/g, "").slice(0, 8);
  return `${namePart}-${shortId}`;
}

/** Extract the 8-char hex shortId from the end of a slug */
export function shortIdFromSlug(slug: string): string {
  return slug.slice(-8);
}
