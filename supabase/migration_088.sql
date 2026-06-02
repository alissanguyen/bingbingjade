-- Migration 088: Add item_expense_usd to inventory_batch_items
--
-- Per-product expense (e.g. absorbed free shipping) tracked separately
-- from the inventory cost allocation.

ALTER TABLE public.inventory_batch_items
  ADD COLUMN IF NOT EXISTS item_expense_usd numeric(12,2) NOT NULL DEFAULT 0;
