-- migration_038: Add per-variant sale price and combo dependency tracking
--
-- sale_price_usd: optional sale/discounted price for a specific variant.
--   When set, the product page shows the sale price with a strikethrough original
--   price and calculates the discount % purely from sale_price_usd / price_usd.
--
-- combo_of: array of product_option UUIDs this variant depends on.
--   If any referenced variant is sold, this variant is automatically shown as
--   "Unavailable" on the product page (e.g. a Set listing depends on its
--   component Bangle and Ring variants being available).

ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS sale_price_usd numeric(10,2),
  ADD COLUMN IF NOT EXISTS combo_of uuid[];
