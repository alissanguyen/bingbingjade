-- Migration 012: product_options table
--
-- Products become listing containers. Options are the actual sellable items.
-- Three use cases:
--   1. label = null, 1 option  → single one-of-one piece (current behavior, no UI selector)
--   2. label = text, N options → grouped exact items ("Ring A", "Ring B") — user must choose
--   3. label = text, N options → size range / batch ("51–52mm", "53–54mm") — user picks range
--
-- Inheritance rules:
--   size     = null → inherit product.size
--   price_usd = null → inherit product.price_display_usd
--   images   = '{}'  → inherit product.images

CREATE TABLE public.product_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label        text,                    -- null = no selector needed
  size         numeric,                 -- null = inherit product.size
  price_usd    numeric(10,2),           -- null = inherit product.price_display_usd
  images       text[] NOT NULL DEFAULT '{}', -- empty = use product.images
  status       text NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'sold')),
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_options_product_id_idx ON public.product_options (product_id, sort_order);

-- Backfill: create one default option per existing product.
-- label=null means no selector shown — preserves current UX for all existing listings.
INSERT INTO public.product_options (product_id, label, size, price_usd, images, status, sort_order)
SELECT
  id,
  null,                      -- no selector for existing single items
  size,                      -- copy current size as explicit value
  price_display_usd,         -- copy current price
  '{}',                      -- use product-level images
  CASE WHEN status = 'sold' THEN 'sold' ELSE 'available' END,
  0
FROM public.products;
