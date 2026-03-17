-- Migration 010: Add slug and public_id columns to products
-- slug  — SEO-friendly URL segment derived from product name
-- public_id — short stable lookup key (8 hex chars, URL-safe)

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS public_id text;

-- Backfill slug from name: lowercase, non-alphanumeric → hyphen, trim edges
UPDATE products
SET slug = regexp_replace(
             regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
             '^-+|-+$', '', 'g'
           )
WHERE slug IS NULL;

-- Backfill public_id from first 8 hex chars of uuid (deterministic, no collision risk)
UPDATE products
SET public_id = left(replace(id::text, '-', ''), 8)
WHERE public_id IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE products ALTER COLUMN slug SET NOT NULL;
ALTER TABLE products ALTER COLUMN public_id SET NOT NULL;

-- Unique indexes for lookups and constraint
CREATE UNIQUE INDEX IF NOT EXISTS products_public_id_idx ON products (public_id);
