-- migration_038: Rename 'custom_order' → 'raw_material', 'other' → 'earring'

-- 1. Migrate existing data
UPDATE products SET category = 'raw_material' WHERE category = 'custom_order';
UPDATE products SET category = 'earring'      WHERE category = 'other';

-- 2. Replace the category check constraint
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'set', 'earring', 'raw_material'));
