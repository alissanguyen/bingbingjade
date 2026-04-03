-- Migration 041: Add fulfillment_type to order_items
-- Tracks whether each item was available_now (U.S. inventory) or sourced_for_you (sourced on order).

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fulfillment_type text
    CHECK (fulfillment_type IN ('available_now', 'sourced_for_you'));
