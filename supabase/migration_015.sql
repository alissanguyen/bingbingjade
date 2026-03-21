-- migration_015: performance indexes + Row Level Security for sensitive tables
--
-- Run once against your Supabase project via the SQL editor or CLI.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS guards).

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Speed up the /products page filter queries (status filter is the most common)
CREATE INDEX IF NOT EXISTS products_status_idx        ON products (status);
CREATE INDEX IF NOT EXISTS products_category_idx      ON products (category);

-- Speed up webhook and cart validation option lookups
CREATE INDEX IF NOT EXISTS product_options_product_id_idx ON product_options (product_id);
CREATE INDEX IF NOT EXISTS product_options_status_idx     ON product_options (status);

-- Speed up admin order list
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────

-- product_options: public read (cart/checkout needs to fetch options), no public write
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_options_public_read" ON product_options;
CREATE POLICY "product_options_public_read"
  ON product_options FOR SELECT
  USING (true);

-- orders: no public access — only the service-role key (admin) can read/write
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- (No permissive policy = anon/authenticated roles cannot read or write)

-- order_items: no public access
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- (No permissive policy = anon/authenticated roles cannot read or write)
