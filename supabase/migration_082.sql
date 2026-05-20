-- Migration 082: Customer restriction system
-- Adds customer_restrictions and blocked_checkout_attempts tables.
-- Restriction matching happens server-side in lib/customer-restrictions.ts.

CREATE TABLE IF NOT EXISTS public.customer_restrictions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  name             text,
  email            text,
  normalized_email text,
  phone            text,
  normalized_phone text,
  address_line1    text,
  address_line2    text,
  city             text,
  state            text,
  postal_code      text,
  country          text,
  normalized_address text,
  reason           text,
  internal_notes   text,
  status           text        NOT NULL DEFAULT 'active'   CHECK (status   IN ('active', 'inactive')),
  severity         text        NOT NULL DEFAULT 'blocked'  CHECK (severity IN ('blocked', 'review')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_normalized_email_idx
  ON public.customer_restrictions (normalized_email)
  WHERE status = 'active' AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS cr_normalized_phone_idx
  ON public.customer_restrictions (normalized_phone)
  WHERE status = 'active' AND normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS cr_normalized_address_idx
  ON public.customer_restrictions (normalized_address)
  WHERE status = 'active' AND normalized_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS cr_customer_id_idx
  ON public.customer_restrictions (customer_id)
  WHERE status = 'active' AND customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cr_status_idx
  ON public.customer_restrictions (status);

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_checkout_attempts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_id      uuid        REFERENCES public.customer_restrictions(id) ON DELETE SET NULL,
  matched_signals     jsonb,
  attempted_customer  jsonb,
  cart_snapshot       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bca_restriction_id_idx
  ON public.blocked_checkout_attempts (restriction_id);

CREATE INDEX IF NOT EXISTS bca_created_at_idx
  ON public.blocked_checkout_attempts (created_at DESC);
