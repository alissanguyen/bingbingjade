-- migration_038: Rename 'custom_order' → 'raw_material', 'other' → 'earring'

-- 1. Drop the old constraint first so updates aren't blocked
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_check;

-- 2. Migrate existing data
UPDATE products SET category = 'raw_material' WHERE category = 'custom_order';
UPDATE products SET category = 'earring'      WHERE category = 'other';

-- 3. Add the new constraint with updated values
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'set', 'earring', 'raw_material'));
