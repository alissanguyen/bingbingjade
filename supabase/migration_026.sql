-- migration_026: Add fee_breakdown column to orders
-- Stores optional fee lines (shipping, tax, PayPal fee, other) as JSONB
-- so the admin order detail and customer tracking page can display them.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb;
