-- Migration 097: Product reservation system (code-gated reservations with deposit)
--
-- Admin creates a reservation with a plaintext code.
-- The code is stored as a SHA-256 hash (never stored in plaintext).
-- Customers enter the code on the product page to unlock checkout.
-- Admin can optionally generate a deposit Stripe checkout link.

CREATE TABLE IF NOT EXISTS public.product_reservations (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reservation_code_hash       text        NOT NULL,           -- SHA-256 of plaintext code (lowercased, trimmed)
  customer_name               text,
  customer_email              text,
  customer_note               text,
  deposit_amount_usd          numeric(10,2) NOT NULL DEFAULT 0,
  deposit_paid                boolean     NOT NULL DEFAULT false,
  deposit_paid_at             timestamptz,
  deposit_stripe_session_id   text,
  deposit_payment_intent_id   text,
  expires_at                  timestamptz NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  cancelled_at                timestamptz
);

-- Only one active (non-cancelled) reservation per product
CREATE UNIQUE INDEX IF NOT EXISTS product_reservations_product_active_idx
  ON public.product_reservations (product_id)
  WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS product_reservations_product_id_idx
  ON public.product_reservations (product_id);

CREATE INDEX IF NOT EXISTS product_reservations_expires_at_idx
  ON public.product_reservations (expires_at);

-- Admin-only (supabaseAdmin bypasses RLS)
ALTER TABLE public.product_reservations ENABLE ROW LEVEL SECURITY;
