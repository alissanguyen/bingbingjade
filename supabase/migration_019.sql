-- ============================================================
-- migration_019: Order/customer system expansion
--
-- Additive only — no existing columns, tables, or constraints
-- are removed. The existing webhook INSERT continues to work
-- because every new column has a safe DEFAULT or is nullable.
-- ============================================================

-- ── Order number sequence ──────────────────────────────────
-- Starts at 1001; gaps are fine (sequence never rolls back).
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- RPC helper callable via supabaseAdmin.rpc('next_order_number')
CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'BBJ-' || nextval('public.order_number_seq')::text;
$$;

-- ── Customers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name        text        NOT NULL,
  customer_email       text        NOT NULL,
  customer_phone       text,
  stripe_customer_id   text,
  number_of_orders     integer     NOT NULL DEFAULT 1,
  -- Threshold: 3+ orders → frequent customer
  is_frequent_customer boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_email)
);

CREATE INDEX IF NOT EXISTS customers_email_idx
  ON public.customers (customer_email);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only

-- ── Customer addresses ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid        NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  recipient_name  text,
  address_line1   text        NOT NULL,
  address_line2   text,
  city            text        NOT NULL,
  state_or_region text        NOT NULL,
  postal_code     text        NOT NULL,
  country         text        NOT NULL DEFAULT 'US',
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx
  ON public.customer_addresses (customer_id);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only

-- ── Extend orders ─────────────────────────────────────────
-- Allow NULL stripe_session_id for manual/admin orders.
-- The UNIQUE constraint is preserved so idempotency still works.
ALTER TABLE public.orders
  ALTER COLUMN stripe_session_id DROP NOT NULL;

-- Human-friendly order number (e.g. BBJ-1001)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text UNIQUE;

-- Customer link
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers (id);

-- Stripe enrichment (payment_intent for refunds/disputes, customer for CRM)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Fulfillment workflow status (separate from payment status)
-- Existing rows default to 'order_confirmed' — correct for paid Stripe orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'order_confirmed'
  CHECK (order_status IN (
    'order_created',       -- admin/manual order not yet confirmed
    'order_confirmed',     -- payment received / admin confirmed
    'quality_control',     -- piece being inspected
    'certifying',          -- GIA/cert in progress
    'inbound_shipping',    -- shipping to BingBing main location
    'outbound_shipping',   -- shipping to customer
    'delivered'            -- confirmed received
  ));

-- Logistics
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address_id uuid
  REFERENCES public.customer_addresses (id);

-- Snapshot extras
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_phone_snapshot text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notes text;

-- Order source — Stripe orders default correctly without explicit value
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe'
  CHECK (source IN ('stripe', 'whatsapp', 'cash', 'custom', 'admin'));

-- ── Extend order_items ────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_total numeric(10, 2);

-- Backfill line_total for existing rows (quantity was always 1)
UPDATE public.order_items
  SET line_total = price_usd
  WHERE line_total IS NULL AND price_usd IS NOT NULL;

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_order_number_idx
  ON public.orders (order_number)
  WHERE order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_customer_id_idx
  ON public.orders (customer_id);

CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_idx
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
