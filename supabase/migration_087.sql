-- Migration 087: Add image_path to reviews; drop review_images table
--
-- Simplify review images: one optional image stored directly on the review
-- row instead of a separate review_images table.

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_path text;

DROP TABLE IF EXISTS public.review_images CASCADE;
