-- Migration 043: Custom Sourcing feature
-- Adds sourcing_requests, sourcing_credit_ledger tables and extends orders.

-- ── 1. sourcing_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sourcing_requests (
  id                         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email             text        NOT NULL,
  customer_name              text        NOT NULL,
  user_id                    uuid,       -- nullable; for future logged-in users
  category                   text        NOT NULL,
  budget_min                 integer     NOT NULL,  -- USD (dollars, not cents)
  budget_max                 integer,              -- USD, nullable
  request_type               text        NOT NULL
                               CHECK (request_type IN ('standard', 'premium')),
  strictness_score           integer     NOT NULL DEFAULT 0,
  preferences_json           jsonb       NOT NULL DEFAULT '{}',
  reference_images_json      jsonb       NOT NULL DEFAULT '[]',
  deposit_amount_cents       integer     NOT NULL,
  currency                   text        NOT NULL DEFAULT 'usd',
  payment_status             text        NOT NULL DEFAULT 'awaiting_payment'
                               CHECK (payment_status IN ('awaiting_payment', 'paid', 'refunded', 'expired')),
  sourcing_status            text        NOT NULL DEFAULT 'queued'
                               CHECK (sourcing_status IN ('queued', 'options_sent', 'in_progress', 'fulfilled', 'cancelled')),
  stripe_checkout_session_id text        UNIQUE,
  stripe_payment_intent_id   text,
  paid_at                    timestamptz,
  credit_expires_at          timestamptz,
  -- Optimistic credit lock (prevents double-spend across concurrent checkouts)
  credit_claimed_at          timestamptz,
  credit_claimed_session_id  text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- ── 2. sourcing_credit_ledger ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sourcing_credit_ledger (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sourcing_request_id  uuid        NOT NULL
                         REFERENCES public.sourcing_requests(id) ON DELETE RESTRICT,
  customer_email       text        NOT NULL,
  user_id              uuid,
  event_type           text        NOT NULL
                         CHECK (event_type IN ('credit_created', 'credit_consumed', 'credit_refunded', 'credit_expired')),
  amount_cents         integer     NOT NULL,
  currency             text        NOT NULL DEFAULT 'usd',
  order_id             uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  checkout_session_id  text,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Extend orders table ────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sourcing_credit_applied integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sourcing_request_id uuid
    REFERENCES public.sourcing_requests(id) ON DELETE SET NULL;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_email
  ON public.sourcing_requests(customer_email);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_payment_status
  ON public.sourcing_requests(payment_status);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_sourcing_status
  ON public.sourcing_requests(sourcing_status);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_created_at
  ON public.sourcing_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sourcing_requests_stripe_session
  ON public.sourcing_requests(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sourcing_credit_ledger_request_id
  ON public.sourcing_credit_ledger(sourcing_request_id);

CREATE INDEX IF NOT EXISTS idx_sourcing_credit_ledger_email
  ON public.sourcing_credit_ledger(customer_email);

CREATE INDEX IF NOT EXISTS idx_sourcing_credit_ledger_order_id
  ON public.sourcing_credit_ledger(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sourcing_credit_ledger_checkout_session
  ON public.sourcing_credit_ledger(checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sourcing_request_id
  ON public.orders(sourcing_request_id)
  WHERE sourcing_request_id IS NOT NULL;
