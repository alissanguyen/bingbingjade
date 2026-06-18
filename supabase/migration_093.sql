-- Migration 093: Add receipt_storage_path to product_costs
--
-- Allows attaching a receipt/invoice file (any format) to each product cost record.
-- Stored in the jade-images Supabase Storage bucket under receipts/product-costs/{id}/.

ALTER TABLE public.product_costs
  ADD COLUMN IF NOT EXISTS receipt_storage_path text;
