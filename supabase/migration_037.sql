-- migration_037: Add 'set' as a product category (for bundled pieces: bangle + bracelet + ring, etc.)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'set', 'other', 'custom_order'));
