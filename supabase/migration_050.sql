-- Migration 050: allow 'on_sale' status for product_options
--
-- The product_options.status check constraint originally only allowed
-- 'available' and 'sold'. Adding 'on_sale' to match product-level status.

ALTER TABLE public.product_options
  DROP CONSTRAINT IF EXISTS product_options_status_check,
  ADD CONSTRAINT product_options_status_check
    CHECK (status IN ('available', 'sold', 'on_sale'));
