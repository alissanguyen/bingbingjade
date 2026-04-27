-- migration_061: Backfill product_original_images for all existing listings
-- For every product that has a SKU and images stored as wm/ paths,
-- derive the originals/ path and insert a row into product_original_images.
-- Skips duplicates (ON CONFLICT DO NOTHING) so safe to run multiple times.

INSERT INTO product_original_images (sku, original_storage_path, uploaded_at)
SELECT
  p.sku,
  -- "wm/1712345678-abc123.jpg" → "originals/1712345678-abc123"
  'originals/' || regexp_replace(img, '^wm/(.+)\.[^.]+$', '\1') AS original_storage_path,
  p.created_at AS uploaded_at
FROM
  products p,
  unnest(p.images) AS img
WHERE
  p.sku IS NOT NULL
  AND img LIKE 'wm/%'
ON CONFLICT DO NOTHING;
