-- migration_033: Add rejection tracking to products

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rejected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- Index for quickly fetching a partner's rejected submissions
CREATE INDEX IF NOT EXISTS idx_products_rejected_at
  ON products (rejected_at)
  WHERE rejected_at IS NOT NULL;
