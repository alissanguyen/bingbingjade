-- ============================================================
-- migration_022: Custom order support
-- Adds in_production + polishing statuses and order_type column
-- ============================================================

-- Expand order_status check to include manufacturing statuses
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'order_created',
    'order_confirmed',
    'in_production',
    'polishing',
    'quality_control',
    'certifying',
    'inbound_shipping',
    'outbound_shipping',
    'delivered',
    'order_cancelled'
  ));

-- Order type: standard (ready-made purchase) or custom (bespoke commission)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'standard'
  CHECK (order_type IN ('standard', 'custom'));
