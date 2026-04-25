-- migration_055: Add show_price toggle to products
--
-- price_display_usd is now always set by admin (required in UI).
-- show_price controls whether the price is rendered publicly.
-- When false, the storefront shows "Contact for Price" and the price
-- is never included in any client-visible response.

ALTER TABLE products ADD COLUMN show_price boolean NOT NULL DEFAULT false;

-- Preserve current behavior: products that already have a price set keep showing it.
UPDATE products SET show_price = true WHERE price_display_usd IS NOT NULL;
