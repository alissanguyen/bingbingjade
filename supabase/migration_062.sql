-- migration_062: Add vendor_id to product_original_images + backfill

ALTER TABLE product_original_images
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

-- Backfill vendor_id for all existing rows (matched via SKU → product → vendor)
UPDATE product_original_images poi
SET vendor_id = p.vendor_id
FROM products p
WHERE poi.sku = p.sku
  AND poi.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Backfill any missing rows for existing listings (safe to re-run)
INSERT INTO product_original_images (sku, original_storage_path, uploaded_at, vendor_id)
SELECT
  p.sku,
  'originals/' || regexp_replace(img, '^wm/(.+)\.[^.]+$', '\1') AS original_storage_path,
  p.created_at AS uploaded_at,
  p.vendor_id
FROM
  products p,
  unnest(p.images) AS img
WHERE
  p.sku IS NOT NULL
  AND img LIKE 'wm/%'
ON CONFLICT DO NOTHING;
