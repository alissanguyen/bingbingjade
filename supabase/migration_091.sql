-- Migration 091: Add renewed_at to products
--
-- Tracks when a listing was last renewed to appear first in sort order.
-- created_at is never modified; renewed_at is set on renewal only.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS renewed_at timestamptz;
