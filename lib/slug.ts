export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generates e.g. "icy-green-jade-bangle-56mm-550e8400-e29b-41d4-a716-446655440000" */
export function productSlug(product: { id: string; name: string }): string {
  return `${slugify(product.name)}-${product.id}`;
}

/** Extracts the full UUID from the end of a slug */
export function uuidFromSlug(slug: string): string | null {
  const match = slug.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : null;
}
