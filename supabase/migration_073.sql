-- Add 'archived' to product status constraint and track published_at timestamp.

-- 1. Extend status constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('available', 'sold', 'on_sale', 'archived'));

-- 2. Track when a product was first published (used for auto-archive after 30 days)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Backfill: for currently-published products that aren't sold, set published_at = created_at
-- (conservative — they've been listed at least since creation)
UPDATE products
  SET published_at = created_at
  WHERE is_published = true
    AND status NOT IN ('sold', 'archived')
    AND published_at IS NULL;

-- Index for cron query
CREATE INDEX IF NOT EXISTS products_published_at_idx
  ON products (published_at)
  WHERE published_at IS NOT NULL AND status NOT IN ('sold', 'archived');
