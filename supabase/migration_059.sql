-- migration_059: Supplies reconciliation columns in accounting_summaries
-- Adds per-period supplies tracking so estimated vs actual can be compared
-- without double-counting in the tax-ready P&L.

ALTER TABLE accounting_summaries
  ADD COLUMN IF NOT EXISTS estimated_supplies_cost   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_supplies_spend     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplies_delta            numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_supplies_per_order numeric(10,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS fulfillment_ex_supplies   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_ready_profit          numeric(12,2) NOT NULL DEFAULT 0;
