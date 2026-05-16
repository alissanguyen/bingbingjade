-- Convert clearance from a status value to a boolean merchandising flag.
-- Step 1: add the new column (safe — existing rows default to false).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_clearance boolean NOT NULL DEFAULT false;

-- Step 2: migrate any rows that used status='clearance' before tightening the constraint.
UPDATE public.products
  SET status = 'available', is_clearance = true
  WHERE status = 'clearance';

-- Step 3: now that no rows have status='clearance', drop and recreate the check constraint.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check,
  ADD CONSTRAINT products_status_check
    CHECK (status IN ('available', 'sold', 'on_sale', 'archived'));
