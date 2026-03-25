-- ============================================================
-- migration_022: Custom order support
-- Adds in_production + polishing statuses and is_custom_order flag
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

-- Flag to distinguish custom/bespoke commissioned orders from ready-made purchases
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_custom_order boolean NOT NULL DEFAULT false;
