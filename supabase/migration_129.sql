-- Migration 129: certificate ID on inventory batch items
-- Each product linked to an inventory batch records the lab certificate ID
-- so certificates can be tracked per piece. Required by the API when adding
-- a product to a batch; nullable here so pre-existing rows stay valid.

ALTER TABLE public.inventory_batch_items
  ADD COLUMN IF NOT EXISTS certificate_id text;

CREATE INDEX IF NOT EXISTS ibi_certificate_id_idx
  ON public.inventory_batch_items (certificate_id);
