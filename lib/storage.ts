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
export const REVIEW_IMAGE_BUCKET = "review-images";
/** Public bucket for admin-uploaded BingBing Gallery images (logo already baked in). */
export const BINGBING_GALLERY_BUCKET = "bingbing-gallery";
/** Private bucket for employee-uploaded draft images/videos — never public. */
export const EMPLOYEE_DRAFT_BUCKET = "jade-employee-drafts";
/**
 * Private bucket for customer-submitted service-request attachments
 * (restoration/preservation photos, staff inspection photos, etc.). Never
 * public — these are a customer's own diagnostic photos of their jewelry,
 * not product marketing images. Always resolved via short-lived signed URLs.
 */
export const SERVICE_REQUEST_BUCKET = "service-request-attachments";

/** Signed URL TTL for videos (seconds). 7 days. */
const VIDEO_TTL = 60 * 60 * 24 * 7;
const MEDIA_RESOLVE_TIMEOUT_MS = 1500;

/** Returns true if the value is a storage path rather than a full URL. */
export function isStoragePath(value: string): boolean {
  return !value.startsWith("http");
}

/**
 * Normalise any Supabase Storage URL for a managed bucket back to a bare
 * storage path. This corrects the case where a resolved URL was accidentally
 * saved to the database instead of the original path — including a signed
 * jade-employee-drafts preview URL saved via the admin listing-review page
 * (see app/admin/listing-approvals/[listingId]/page.tsx, which resolves
 * still-private draft images to short-lived signed URLs so an admin can
 * preview them inside the shared EditForm component before the listing is
 * promoted/published). Without this bucket in the allowlist, that signed
 * URL — token, 10-minute expiry, and all — would be saved verbatim.
 *
 * Examples:
 *   "wm/abc.jpg"                                             → "wm/abc.jpg"  (no-op)
 *   ".../object/sign/jade-images/wm/abc.jpg?token=…"        → "wm/abc.jpg"
 *   ".../object/public/jade-images/wm/abc.jpg"               → "wm/abc.jpg"
 *   ".../object/sign/jade-employee-drafts/wm/abc.jpg?token=…" → "wm/abc.jpg"
 *   ".../object/public/product-images/abc.jpg"               → unchanged    (legacy bucket)
 */
export function toStoragePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  for (const bucket of [IMAGE_BUCKET, VIDEO_BUCKET, EMPLOYEE_DRAFT_BUCKET]) {
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

async function withMediaTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), MEDIA_RESOLVE_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.warn("[storage] media URL resolution failed; using fallback paths", err);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function resolveImageUrlsFailSoft(pathsOrUrls: string[]): Promise<string[]> {
  return withMediaTimeout(resolveImageUrls(pathsOrUrls), pathsOrUrls);
}

export async function resolveFirstImageUrlFailSoft(images: string[]): Promise<string | null> {
  return withMediaTimeout(resolveFirstImageUrl(images), images[0] ?? null);
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

/** 1200 px square WebP — main product gallery image. */
export const productGalleryUrl = (src: string) =>
  supabaseImageUrl(src, { width: 1200, height: 1200, quality: 78, format: "webp" });

/** 1800 px wide WebP — product lightbox/zoom image. */
export const productZoomUrl = (src: string) =>
  supabaseImageUrl(src, { width: 1800, quality: 82, format: "webp", resize: "contain" });

/** 128 px wide WebP — cart thumbnails, navbar search, small admin chips */
export const productMicroUrl = (src: string) =>
  supabaseImageUrl(src, { width: 128, height: 128, quality: 80, format: "webp" });

// ── Review image helpers — public bucket ─────────────────────────────────────

export function reviewImagePublicUrl(path: string): string {
  const storageBase = supabaseStorageBase();
  if (!storageBase) return path;
  return `${storageBase}/object/public/${REVIEW_IMAGE_BUCKET}/${path.replace(/^\/+/, "")}`;
}

export function reviewImageThumbnailUrl(path: string, width = 400): string {
  const storageBase = supabaseStorageBase();
  if (!storageBase) return path;
  return `${storageBase}/render/image/public/${REVIEW_IMAGE_BUCKET}/${path.replace(/^\/+/, "")}?width=${width}&quality=75&format=webp&resize=cover`;
}

// ── BingBing Gallery image helpers — public bucket ────────────────────────────

export function bingbingGalleryPublicUrl(path: string): string {
  const storageBase = supabaseStorageBase();
  if (!storageBase) return path;
  return `${storageBase}/object/public/${BINGBING_GALLERY_BUCKET}/${path.replace(/^\/+/, "")}`;
}

export function bingbingGalleryThumbnailUrl(path: string, width = 600): string {
  const storageBase = supabaseStorageBase();
  if (!storageBase) return path;
  return `${storageBase}/render/image/public/${BINGBING_GALLERY_BUCKET}/${path.replace(/^\/+/, "")}?width=${width}&quality=80&format=webp&resize=cover`;
}

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

export async function resolveVideoUrlsFailSoft(pathsOrUrls: string[]): Promise<string[]> {
  return withMediaTimeout(resolveVideoUrls(pathsOrUrls), pathsOrUrls);
}

// ── Employee draft media — private bucket, signed URLs, ownership-checked ────
//
// Employee-uploaded images/videos live in EMPLOYEE_DRAFT_BUCKET while a
// listing is EMPLOYEE_DRAFT / AWAITING_APPROVAL / NEEDS_ADJUSTMENT /
// APPROVED_UNPUBLISHED. Nothing in this bucket is ever public — resolving a
// URL always requires a signed request, and callers are expected to have
// already checked the requester owns (or is admin for) the product that
// references the path (see app/api/employee/media/route.ts).

const DRAFT_MEDIA_TTL = 60 * 10; // 10 minutes — short-lived, re-requested per page view

export async function resolveEmployeeDraftUrl(path: string): Promise<string | null> {
  if (!isStoragePath(path)) return path;
  const { supabaseAdmin } = await import("./supabase-admin");
  const { data } = await supabaseAdmin.storage
    .from(EMPLOYEE_DRAFT_BUCKET)
    .createSignedUrl(path, DRAFT_MEDIA_TTL);
  return data?.signedUrl ?? null;
}

// ── Service-request attachments — private bucket, signed URLs ────────────────
//
// Customer-submitted restoration/preservation photos and staff inspection
// photos. Callers (customer tracker page, admin service-request detail page)
// are expected to have already checked the requester owns (customer token
// match) or is staff for the service_request that references the path.

const SERVICE_REQUEST_MEDIA_TTL = 60 * 10; // 10 minutes

export async function resolveServiceAttachmentUrl(path: string): Promise<string | null> {
  if (!isStoragePath(path)) return path;
  const { supabaseAdmin } = await import("./supabase-admin");
  const { data } = await supabaseAdmin.storage
    .from(SERVICE_REQUEST_BUCKET)
    .createSignedUrl(path, SERVICE_REQUEST_MEDIA_TTL);
  return data?.signedUrl ?? null;
}

export async function resolveServiceAttachmentUrls(paths: string[]): Promise<Array<string | null>> {
  if (paths.length === 0) return [];
  const { supabaseAdmin } = await import("./supabase-admin");
  const { data } = await supabaseAdmin.storage
    .from(SERVICE_REQUEST_BUCKET)
    .createSignedUrls(paths, SERVICE_REQUEST_MEDIA_TTL);
  const signed = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);
  return paths.map((p) => signed.get(p) ?? null);
}

/**
 * Copy an approved draft object into its permanent public/private bucket at
 * publish time. Cross-bucket, so this downloads then re-uploads rather than
 * using storage's same-bucket copy(). Returns the new path (same basename,
 * new bucket) or null on failure — callers should treat a null as "keep the
 * product's images/videos referencing the draft path" rather than losing the
 * media, and can retry the promotion later.
 */
export async function promoteEmployeeDraftObject(
  path: string,
  targetBucket: typeof IMAGE_BUCKET | typeof VIDEO_BUCKET
): Promise<string | null> {
  const { supabaseAdmin } = await import("./supabase-admin");
  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from(EMPLOYEE_DRAFT_BUCKET)
    .download(path);
  if (downloadError || !file) return null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(targetBucket)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (uploadError) return null;

  return path;
}

/**
 * Promote every image/video on a listing from the draft bucket to the
 * public/permanent buckets in one call — used when an admin publishes an
 * employee-submitted listing. Best-effort per object (a single failed
 * promotion doesn't abort the rest); callers should log any returned
 * failures for manual follow-up rather than blocking the publish action on
 * them, since the product row itself is already the source of truth for
 * which paths it references.
 */
export async function promoteProductDraftMedia(
  images: string[],
  videos: string[]
): Promise<{ failedImages: string[]; failedVideos: string[] }> {
  const failedImages: string[] = [];
  const failedVideos: string[] = [];

  await Promise.all([
    ...images.map(async (path) => {
      if (!isStoragePath(path)) return;
      const result = await promoteEmployeeDraftObject(path, IMAGE_BUCKET);
      if (!result) failedImages.push(path);
    }),
    ...videos.map(async (path) => {
      if (!isStoragePath(path)) return;
      const result = await promoteEmployeeDraftObject(path, VIDEO_BUCKET);
      if (!result) failedVideos.push(path);
    }),
  ]);

  return { failedImages, failedVideos };
}
