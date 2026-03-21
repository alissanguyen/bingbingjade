/**
 * Storage utilities for private Supabase media buckets.
 *
 * Images: all product images in the DB are watermarked `wm/` paths. These are
 * served as permanent public URLs — no TTL, no signing, no expiry. The
 * `jade-images` bucket must have public read enabled (Supabase dashboard →
 * Storage → jade-images → Make Public, or run migration_017.sql).
 *
 * The `originals/` prefix (admin backups) is never stored in the DB and
 * therefore never exposed to customers.
 *
 * Videos: stay on signed URLs (7-day TTL) because the jade-videos bucket
 * remains private.
 *
 * Backward compat: older products stored full https:// URLs directly.
 * isStoragePath() detects which is which.
 */

import { supabaseAdmin } from "./supabase-admin";

export const IMAGE_BUCKET = "jade-images";
export const VIDEO_BUCKET = "jade-videos";

/** Signed URL TTL for videos (seconds). 7 days. */
const VIDEO_TTL = 60 * 60 * 24 * 7;

/** Returns true if the value is a storage path rather than a full URL. */
export function isStoragePath(value: string): boolean {
  return !value.startsWith("http");
}

/**
 * Normalise any Supabase Storage URL for a managed bucket back to a bare
 * storage path. This corrects the case where a resolved URL was accidentally
 * saved to the database instead of the original path.
 *
 * Examples:
 *   "wm/abc.jpg"                                       → "wm/abc.jpg"  (no-op)
 *   ".../object/sign/jade-images/wm/abc.jpg?token=…"  → "wm/abc.jpg"
 *   ".../object/public/jade-images/wm/abc.jpg"         → "wm/abc.jpg"
 *   ".../object/public/product-images/abc.jpg"         → unchanged    (legacy bucket)
 */
export function toStoragePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  for (const bucket of [IMAGE_BUCKET, VIDEO_BUCKET]) {
    const match = urlOrPath.match(new RegExp(`/object/(?:sign|public)/${bucket}/([^?]+)`));
    if (match) return match[1];
  }
  return urlOrPath; // legacy public-bucket URL — keep as-is
}

/**
 * Build a permanent public URL for a storage path.
 * Requires the jade-images bucket to have public read enabled (migration_017).
 */
function publicImageUrl(path: string): string {
  const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Image helpers — permanent public URLs, no async needed ───────────────────

export async function resolveImageUrl(pathOrUrl: string): Promise<string> {
  const path = toStoragePath(pathOrUrl); // normalise any accidentally-stored URLs
  if (!isStoragePath(path)) return path;
  return publicImageUrl(path);
}

export async function resolveImageUrls(pathsOrUrls: string[]): Promise<string[]> {
  return pathsOrUrls.map((p) => {
    const path = toStoragePath(p);
    return isStoragePath(path) ? publicImageUrl(path) : path;
  });
}

export async function resolveFirstImageUrl(images: string[]): Promise<string | null> {
  if (!images?.length) return null;
  return resolveImageUrl(images[0]);
}

// ── Video helpers — signed URLs (private bucket) ──────────────────────────────

export async function resolveVideoUrl(pathOrUrl: string): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;
  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(pathOrUrl, VIDEO_TTL);
  return data?.signedUrl ?? pathOrUrl;
}

export async function resolveVideoUrls(pathsOrUrls: string[]): Promise<string[]> {
  if (pathsOrUrls.length === 0) return [];

  const paths = pathsOrUrls.filter(isStoragePath);
  if (paths.length === 0) return pathsOrUrls;

  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrls(paths, VIDEO_TTL);

  const signed = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);
  return pathsOrUrls.map((p) => (isStoragePath(p) ? (signed.get(p) ?? p) : p));
}
