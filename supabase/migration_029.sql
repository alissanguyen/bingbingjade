-- migration_029: Add quick_ship boolean to products
-- Indicates whether a product is eligible for quick/expedited shipping.
-- Defaults to false for all existing and future records.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quick_ship boolean NOT NULL DEFAULT false;
