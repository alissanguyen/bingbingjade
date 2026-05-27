-- Migration 086: Add partner payment tracking to inventory_batches
--
-- partner_payment_usd:    money your partner pays INTO the batch (income to you)
-- payment_to_partner_usd: money you pay BACK to your partner (expense from you)
--
-- Both default to 0 so existing rows are unaffected.

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS partner_payment_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_to_partner_usd  NUMERIC(10,2) NOT NULL DEFAULT 0;
