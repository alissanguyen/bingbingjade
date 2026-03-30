-- migration_032: Approved user pending approval workflow
--
-- Adds three columns to products:
--   pending_approval  — TRUE when an approved user has submitted a listing or edit awaiting admin review
--   pending_data      — JSONB of proposed field values for an edit (NULL for new listings)
--   created_by        — mirrors the orders pattern: 'admin' | 'approved:{uuid}'
--
-- Approval logic:
--   New listing  (pending_approval=TRUE, pending_data IS NULL):  approve → clear flag;  dismiss → DELETE row
--   Pending edit (pending_approval=TRUE, pending_data IS NOT NULL): approve → apply pending_data;  dismiss → discard pending_data

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_data JSONB,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_products_pending_approval
  ON products (pending_approval) WHERE pending_approval = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_created_by
  ON products (created_by);
