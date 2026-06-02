-- Migration 089: Add item_count to inventory_batches
--
-- Informational field: total number of items in the batch, used only to
-- display average cost per item. Not used for proportional cost allocation.

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS item_count integer;
