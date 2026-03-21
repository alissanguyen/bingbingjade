-- migration_016: add is_published column to products
--
-- Products default to draft (is_published = false).
-- Only published products are shown on the storefront.
-- Drafts are visible only in the admin /edit view and on localhost (NODE_ENV=development).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
