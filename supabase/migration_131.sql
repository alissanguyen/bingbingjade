-- Migration 131: separate "Refunded" from "Cancelled" on orders.order_status
--
-- order_status = 'order_cancelled' has been conflating two unrelated
-- outcomes: a true cancellation (piece turned out unavailable after
-- confirming with the vendor, or the customer asked to cancel before/without
-- ever completing the sale) vs. a post-sale refund (an issue was found after
-- the order was paid/delivered and the customer was refunded or credited).
-- The two admin/webhook code paths that issue a full refund after a sale
-- (app/api/admin/orders/[id]/refund/route.ts, the charge.refunded webhook
-- handler) were both writing order_status = 'order_cancelled', which also
-- mislabels the customer-facing tracking page ("This order was cancelled
-- per your request") for what was actually a refund.
--
-- Adds 'order_refunded' as a new order_status value. lib/revenue.ts treats
-- it the same as order_cancelled for net-revenue purposes (always $0) —
-- both represent "this sale no longer counts" for accounting, just for
-- different reasons.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'order_created',
    'order_confirmed',
    'awaiting_vendor_confirmation',
    'in_production',
    'polishing',
    'quality_control',
    'certifying',
    'inbound_shipping',
    'outbound_shipping',
    'delivered',
    'order_cancelled',
    'order_refunded'
  ));
