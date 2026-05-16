-- Add 'clearance' to products.status allowed values.
-- product_options.status intentionally unchanged — clearance is product-level only.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check,
  ADD CONSTRAINT products_status_check
    CHECK (status IN ('available', 'sold', 'on_sale', 'archived', 'clearance'));
