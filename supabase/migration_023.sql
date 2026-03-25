-- migration_023: Add custom_order as a product category
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'other', 'custom_order'));
