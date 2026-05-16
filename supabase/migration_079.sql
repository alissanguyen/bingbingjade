-- Revert 'clearance' from products.status (was added incorrectly as a status value).
-- Add is_clearance as a separate boolean merchandising flag instead.
-- A product can be simultaneously sold + clearance, available + clearance, etc.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check,
  ADD CONSTRAINT products_status_check
    CHECK (status IN ('available', 'sold', 'on_sale', 'archived'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_clearance boolean NOT NULL DEFAULT false;

-- Migrate any products that were set to status='clearance' back to 'available' + is_clearance=true
UPDATE public.products SET status = 'available', is_clearance = true WHERE status = 'clearance';
