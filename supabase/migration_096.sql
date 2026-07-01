-- Add generated column for chronological sort: COALESCE(renewed_at, created_at)
-- This lets the products page sort by effective listing date in a single ORDER BY
-- without pulling all rows into JS.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS effective_date timestamptz
    GENERATED ALWAYS AS (COALESCE(renewed_at, created_at)) STORED;

CREATE INDEX IF NOT EXISTS products_effective_date_idx
  ON public.products (effective_date DESC);
