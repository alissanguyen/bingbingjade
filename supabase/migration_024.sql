-- migration_024: Add status and notes to customers table

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'good_standing'
  CHECK (status IN ('good_standing', 'frequent_client', 'high_risk'));

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notes text;
