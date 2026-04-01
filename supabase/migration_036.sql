-- migration_036: Add 'zelle' as a valid order source
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check
  CHECK (source IN ('stripe', 'whatsapp', 'cash', 'paypal', 'wire', 'zelle', 'custom', 'admin'));
