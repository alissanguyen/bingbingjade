-- migration_060: Product SKU + original images tracking
-- Each product listing gets a unique 8-digit SKU (generated here for all existing products).
-- Every uploaded image is recorded in product_original_images tied to that SKU.

-- SKU column on products (one per listing)
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku char(8) UNIQUE;

-- Backfill all existing products that don't have a SKU yet.
-- Uses lpad(floor(random()*100000000)::text, 8, '0') to generate zero-padded 8-digit codes.
-- Runs in a loop to handle the rare collision case.
DO $$
DECLARE
  r RECORD;
  candidate char(8);
BEGIN
  FOR r IN SELECT id FROM products WHERE sku IS NULL LOOP
    LOOP
      candidate := lpad(floor(random() * 100000000)::bigint::text, 8, '0');
      BEGIN
        UPDATE products SET sku = candidate WHERE id = r.id;
        EXIT; -- success, no conflict
      EXCEPTION WHEN unique_violation THEN
        -- try again
      END;
    END LOOP;
  END LOOP;
END $$;

-- Original images keyed by SKU (multiple images per listing)
CREATE TABLE IF NOT EXISTS product_original_images (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                   char(8)     NOT NULL,
  original_storage_path text        NOT NULL,
  uploaded_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poi_sku_idx ON product_original_images(sku);
