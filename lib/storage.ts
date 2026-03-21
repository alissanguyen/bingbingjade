/**
 * Storage utilities for private Supabase media buckets.
 *
 * New products upload to private buckets (jade-images, jade-videos) and store
 * only the storage path in the database. This module resolves those paths into
 * time-limited signed URLs for rendering.
 *
 * Backward compat: Older products stored full public https:// URLs directly.
 * isStoragePath() detects which is which — public URLs are returned as-is so
 * existing products keep working without any migration.
 *
 * Signed URL TTL: 7 days. ISR revalidates every 6 hours, but Vercel's CDN
 * edge can serve stale pages beyond the revalidation window (stale-while-
 * revalidate, edge cache). A 24h TTL proved too short in production. 7 days
 * gives a comfortable buffer — product images are watermarked and non-sensitive.
 */

import { supabaseAdmin } from "./supabase-admin";

export const IMAGE_BUCKET = "jade-images";
export const VIDEO_BUCKET = "jade-videos";

/** Signed URL TTL in seconds. 7 days. */
const TTL = 60 * 60 * 24 * 7;

/** Returns true if the value is a storage path rather than a full URL. */
export function isStoragePath(value: string): boolean {
  return !value.startsWith("http");
}

// ── Single-item helpers ───────────────────────────────────────────────────────

export async function resolveImageUrl(pathOrUrl: string): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;
  const { data } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .createSignedUrl(pathOrUrl, TTL);
  return data?.signedUrl ?? pathOrUrl;
}

export async function resolveVideoUrl(pathOrUrl: string): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;
  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(pathOrUrl, TTL);
  return data?.signedUrl ?? pathOrUrl;
}

// ── Batch helpers (one Supabase call for the whole array) ────────────────────

export async function resolveImageUrls(pathsOrUrls: string[]): Promise<string[]> {
  if (pathsOrUrls.length === 0) return [];

  const paths = pathsOrUrls.filter(isStoragePath);
  if (paths.length === 0) return pathsOrUrls; // All already public URLs

  const { data } = await supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, TTL);

  const signed = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);
  return pathsOrUrls.map((p) => (isStoragePath(p) ? (signed.get(p) ?? p) : p));
}

export async function resolveVideoUrls(pathsOrUrls: string[]): Promise<string[]> {
  if (pathsOrUrls.length === 0) return [];

  const paths = pathsOrUrls.filter(isStoragePath);
  if (paths.length === 0) return pathsOrUrls;

  const { data } = await supabaseAdmin.storage
    .from(VIDEO_BUCKET)
    .createSignedUrls(paths, TTL);

  const signed = new Map(data?.map((d) => [d.path, d.signedUrl]) ?? []);
  return pathsOrUrls.map((p) => (isStoragePath(p) ? (signed.get(p) ?? p) : p));
}

/**
 * Resolve the first image from a product's images array.
 * Used for thumbnails on listing/homepage where we only need one URL per product.
 */
export async function resolveFirstImageUrl(images: string[]): Promise<string | null> {
  if (!images?.length) return null;
  return resolveImageUrl(images[0]);
}
