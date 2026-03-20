-- Migration 013: add origin column to products
-- Default: Myanmar (most common source). Non-nullable.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'Myanmar';
