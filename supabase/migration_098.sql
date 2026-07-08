-- Migration 098: Add shipping insurance acknowledgement columns to orders
--
-- Persists whether the customer purchased insurance or explicitly declined it.
-- Used for dispute resolution and audit trails.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_insurance_accepted              boolean,
  ADD COLUMN IF NOT EXISTS shipping_insurance_declined_acknowledged boolean;
