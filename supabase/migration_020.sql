-- ============================================================
-- migration_020: Add order_cancelled to order_status check
-- ============================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'order_created',
    'order_confirmed',
    'quality_control',
    'certifying',
    'inbound_shipping',
    'outbound_shipping',
    'delivered',
    'order_cancelled'
  ));
