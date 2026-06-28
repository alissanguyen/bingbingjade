-- Migration 094: Flexible size field + oval bangle support
--
-- 1. Change `size` to text so it can hold ranges ("7.2-7.5"), "Varies", or plain numbers.
-- 2. Add is_oval boolean for oval bangles (enables 4-field dimensions + wrist_size).
-- 3. Add wrist_size text for suitable wrist size guidance on oval bangles.

ALTER TABLE public.products
  ALTER COLUMN size TYPE text USING CASE WHEN size IS NULL THEN NULL ELSE size::text END;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_oval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wrist_size text;
