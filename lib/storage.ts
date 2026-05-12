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
  const storageBase = supabaseStorageBase();
  if (!storageBase) return path;
  return `${storageBase}/object/public/${IMAGE_BUCKET}/${path.replace(/^\/+/, "")}`;
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

// ── Supabase Image Transform ──────────────────────────────────────────────────
//
// Supabase Storage has a built-in image transformation API served at
// /storage/v1/render/image/public/<bucket>/<path>?width=X&quality=Y&format=webp
// Transformed images are cached at Supabase's CDN edge — no Vercel quota used.
//
// Reference: https://supabase.com/docs/guides/storage/serving/image-transformations

function supabaseStorageBase(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1` : "";
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "origin";
  resize?: "cover" | "contain" | "fill";
}

/**
 * Convert any product image URL or storage path into a Supabase Transform URL.
 * Returns non-Supabase URLs (Unsplash, static /public paths) unchanged.
 */
export function supabaseImageUrl(
  srcOrPath: string,
  opts: ImageTransformOptions = {}
): string {
  if (!srcOrPath || srcOrPath.startsWith("/") || srcOrPath.startsWith("blob:")) return srcOrPath;

  const { width = 800, height, quality = 78, format = "webp", resize = "cover" } = opts;
  const storageBase = supabaseStorageBase();
  if (!storageBase) return srcOrPath;

  const objectPrefix = `${storageBase}/object/public/${IMAGE_BUCKET}/`;
  const renderPrefix = `${storageBase}/render/image/public/${IMAGE_BUCKET}/`;

  let filePath: string;
  if (srcOrPath.startsWith(renderPrefix)) {
    filePath = srcOrPath.slice(renderPrefix.length).split("?")[0];
  } else if (srcOrPath.startsWith(objectPrefix)) {
    filePath = srcOrPath.slice(objectPrefix.length);
  } else if (!srcOrPath.startsWith("http")) {
    filePath = srcOrPath; // bare storage path e.g. "wm/abc.jpg"
  } else {
    return srcOrPath; // external URL (Unsplash, legacy bucket, etc.)
  }

  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    format,
    resize,
  });
  if (height) params.set("height", String(height));
  return `${renderPrefix}${filePath}?${params.toString()}`;
}

/** 600 px wide WebP — product card grids and carousels */
export const productThumbUrl = (src: string) =>
  supabaseImageUrl(src, { width: 600, height: 600, quality: 75, format: "webp" });

/** 1200 px wide WebP — main product gallery image. */
export const productGalleryUrl = (src: string) =>
  supabaseImageUrl(src, { width: 1200, quality: 78, format: "webp" });

/** 1800 px wide WebP — product lightbox/zoom image. */
export const productZoomUrl = (src: string) =>
  supabaseImageUrl(src, { width: 1800, quality: 82, format: "webp", resize: "contain" });

/** 128 px wide WebP — cart thumbnails, navbar search, small admin chips */
export const productMicroUrl = (src: string) =>
  supabaseImageUrl(src, { width: 128, height: 128, quality: 80, format: "webp" });

// ── Video helpers — signed URLs (private bucket) ──────────────────────────────

export async function resolveVideoUrl(pathOrUrl: string): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;
  const { supabaseAdmin } = await import("./supabase-admin");
  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(pathOrUrl, VIDEO_TTL);
  return data?.signedUrl ?? pathOrUrl;
}

export async function resolveVideoUrls(pathsOrUrls: string[]): Promise<string[]> {
  if (pathsOrUrls.length === 0) return [];

  const paths = pathsOrUrls.filter(isStoragePath);
  if (paths.length === 0) return pathsOrUrls;

  const { supabaseAdmin } = await import("./supabase-admin");
  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrls(paths, VIDEO_TTL);

  const signed = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);
  return pathsOrUrls.map((p) => (isStoragePath(p) ? (signed.get(p) ?? p) : p));
}
