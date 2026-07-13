-- ============================================================
-- migration_100: Manual capture (authorize-then-capture) support
-- for "Sourced for You" orders.
--
-- Adds capture_status + related timestamps to orders (nullable —
-- NULL means "legacy / auto-capture order", historical rows are
-- untouched). Adds 'awaiting_vendor_confirmation' to order_status.
--
-- Named `capture_status` rather than `payment_status` to avoid
-- colliding with the existing (unrelated) order_payments.payment_status
-- ledger column, which uses a different vocabulary ('paid' |
-- 'partially_refunded' | 'failed').
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS capture_status text
    CHECK (capture_status IN (
      'authorization_pending',
      'authorized',
      'captured',
      'authorization_canceled',
      'authorization_expired',
      'capture_failed',
      'payment_failed',
      'refunded',
      'partially_refunded'
    )),
  ADD COLUMN IF NOT EXISTS authorized_amount integer,
  ADD COLUMN IF NOT EXISTS captured_amount integer,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS authorization_canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_stripe_status text;

CREATE INDEX IF NOT EXISTS orders_capture_status_idx
  ON public.orders (capture_status);

-- Expand order_status check to include the pre-capture "awaiting vendor
-- confirmation" state (existing values preserved from migration_022).
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
    'order_cancelled'
  ));
