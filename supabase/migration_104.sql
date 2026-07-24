-- Migration 104: Fix size range filtering
--
-- Migration 094 changed `size` from numeric to text so it could hold ranges
-- ("7.2-7.5"), "Varies", or plain numbers. That broke minSize/maxSize filtering
-- on the products page: .gte()/.lte() against a text column do lexicographic
-- string comparison in Postgres, so e.g. size >= '1000' matches '54.1' (since
-- '5' > '1' as characters) — the filter looked applied but silently returned
-- near-unfiltered results.
--
-- Add a generated numeric column that holds the parsed value only when `size`
-- is a plain integer/decimal, and NULL for ranges/"Varies"/blank/non-numeric
-- values. Filtering and sorting on size should use this column: NULL never
-- satisfies gte/lte, so non-numeric sizes are automatically excluded whenever
-- a size filter is active.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_mm numeric
    GENERATED ALWAYS AS (
      CASE WHEN size ~ '^[0-9]+(\.[0-9]+)?$' THEN size::numeric ELSE NULL END
    ) STORED;

CREATE INDEX IF NOT EXISTS products_size_mm_idx ON public.products (size_mm);
