-- Migration 130: Re-add 'other' as a product category (for charms, etc.)
--
-- 'other' previously existed (migration_007/023) but was removed and
-- backfilled to 'earring' in migration_038 when it had no real use yet.
-- Re-adding it now for items that don't fit the jewelry-type categories
-- (charms, etc.) — this time it stays rather than getting backfilled away.

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'set', 'earring', 'raw_material', 'other'));
