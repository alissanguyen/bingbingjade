-- Migration 051: replace per-option image arrays with a single image_index pointer
--
-- Instead of each variant having its own images[] array, variants now optionally
-- point to one of the parent product's images by index. All images live at the
-- product level; the variant just highlights which image is "theirs".

ALTER TABLE public.product_options
  ADD COLUMN IF NOT EXISTS image_index int4 DEFAULT NULL;
