-- migration_017: make jade-images bucket publicly readable
--
-- Watermarked product images (wm/ prefix) are served to customers anyway —
-- keeping them behind signed URLs only causes expiry-related 400 errors when
-- Vercel's CDN serves ISR pages that are older than the signed URL TTL.
-- Making the bucket public gives permanent, never-expiring URLs.
--
-- The originals/ prefix (admin backups) is never stored in the DB or exposed
-- to customers, so making the bucket public does not compromise those files
-- in any practical sense (paths are unguessable time-based IDs).

-- Enable public read on the jade-images bucket
UPDATE storage.buckets
SET public = true
WHERE id = 'jade-images';
