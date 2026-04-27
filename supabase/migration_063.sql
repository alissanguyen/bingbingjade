-- migration_063: product_originals — SKU → vendor mapping
-- Stores a denormalized snapshot of which vendor sourced each listing.
-- vendor_name is stored directly so the record survives vendor record changes/deletions.

CREATE TABLE IF NOT EXISTS product_originals (
  sku         char(8)     PRIMARY KEY,
  vendor_id   uuid        REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Backfill from all existing products that have a SKU and a vendor
INSERT INTO product_originals (sku, vendor_id, vendor_name, created_at)
SELECT
  p.sku,
  p.vendor_id,
  COALESCE(v.name, ''),
  p.created_at
FROM products p
LEFT JOIN vendors v ON v.id = p.vendor_id
WHERE p.sku IS NOT NULL
ON CONFLICT (sku) DO NOTHING;
