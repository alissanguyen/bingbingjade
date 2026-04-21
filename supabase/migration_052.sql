-- Migration 052: add shipping_address_json fallback on orders
--
-- When an order has no customer_id (e.g. manual or special-payment orders),
-- we cannot insert into customer_addresses (customer_id is NOT NULL there).
-- This JSONB column stores the address directly on the order as a fallback.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address_json jsonb DEFAULT NULL;
