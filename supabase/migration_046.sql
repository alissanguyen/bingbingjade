-- Migration 046: Full Custom Sourcing Workflow
-- Adds public_token, sourcing_attempts, sourcing_attempt_options, sourcing_checkout_offers

-- ── 1. public_token on sourcing_requests ──────────────────────────────────────
ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

UPDATE public.sourcing_requests
  SET public_token = gen_random_uuid()::text
  WHERE public_token IS NULL;

ALTER TABLE public.sourcing_requests
  ALTER COLUMN public_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS sourcing_requests_public_token_idx
  ON public.sourcing_requests(public_token);

-- ── 2. max_attempts + attempts_used ───────────────────────────────────────────
ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 2;

ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS attempts_used INT NOT NULL DEFAULT 0;

-- Backfill correct max_attempts for existing rows
UPDATE public.sourcing_requests SET max_attempts = 2 WHERE request_type = 'standard';
UPDATE public.sourcing_requests SET max_attempts = 3 WHERE request_type = 'premium';
UPDATE public.sourcing_requests SET max_attempts = 4 WHERE request_type = 'concierge';

-- ── 3. Expand sourcing_status ─────────────────────────────────────────────────
ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_sourcing_status_check;

ALTER TABLE public.sourcing_requests
  ADD CONSTRAINT sourcing_requests_sourcing_status_check
    CHECK (sourcing_status IN (
      'queued',
      'in_progress',
      'awaiting_response',
      'responded',
      'accepted',
      'options_sent',
      'accepted_pending_checkout',
      'checkout_expired',
      'fulfilled',
      'cancelled',
      'closed'
    ));

-- ── 4. sourcing_attempts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sourcing_attempts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sourcing_request_id     UUID        NOT NULL
                            REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
  attempt_number          INT         NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','sent','responded','expired','accepted','closed')),
  sent_at                 TIMESTAMPTZ,
  response_due_at         TIMESTAMPTZ,
  responded_at            TIMESTAMPTZ,
  customer_feedback       TEXT,
  admin_notes             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sourcing_request_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS sourcing_attempts_request_id_idx
  ON public.sourcing_attempts(sourcing_request_id);
CREATE INDEX IF NOT EXISTS sourcing_attempts_status_idx
  ON public.sourcing_attempts(status);
CREATE INDEX IF NOT EXISTS sourcing_attempts_response_due_at_idx
  ON public.sourcing_attempts(response_due_at)
  WHERE response_due_at IS NOT NULL;

-- ── 5. sourcing_attempt_options ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sourcing_attempt_options (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id          UUID        NOT NULL
                        REFERENCES public.sourcing_attempts(id) ON DELETE CASCADE,
  source_product_id   UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  title               TEXT        NOT NULL,
  images_json         JSONB       NOT NULL DEFAULT '[]',
  price_cents         INT         NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'usd',
  tier                TEXT,
  color               TEXT,
  dimensions          TEXT,
  notes               TEXT,
  status              TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN (
                          'draft','active','rejected','accepted',
                          'converted_to_checkout','paid','expired'
                        )),
  customer_reaction   TEXT        CHECK (customer_reaction IN ('liked','disliked','neutral')),
  customer_note       TEXT,
  sort_order          INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_attempt_options_attempt_id_idx
  ON public.sourcing_attempt_options(attempt_id);

-- ── 6. sourcing_checkout_offers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sourcing_checkout_offers (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token                    TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  sourcing_request_id             UUID        NOT NULL
                                    REFERENCES public.sourcing_requests(id) ON DELETE RESTRICT,
  sourcing_attempt_id             UUID        NOT NULL
                                    REFERENCES public.sourcing_attempts(id) ON DELETE RESTRICT,
  sourcing_attempt_option_id      UUID        NOT NULL
                                    REFERENCES public.sourcing_attempt_options(id) ON DELETE RESTRICT,
  customer_email                  TEXT        NOT NULL,
  title_snapshot                  TEXT        NOT NULL,
  images_snapshot_json            JSONB       NOT NULL DEFAULT '[]',
  price_cents                     INT         NOT NULL,
  currency                        TEXT        NOT NULL DEFAULT 'usd',
  sourcing_credit_applied_cents   INT         NOT NULL DEFAULT 0,
  shipping_cents                  INT         NOT NULL DEFAULT 0,
  tx_fee_cents                    INT         NOT NULL DEFAULT 0,
  final_amount_cents              INT         NOT NULL,
  status                          TEXT        NOT NULL DEFAULT 'pending_checkout'
                                    CHECK (status IN ('pending_checkout','paid','expired','canceled')),
  stripe_checkout_session_id      TEXT        UNIQUE,
  stripe_payment_intent_id        TEXT,
  expires_at                      TIMESTAMPTZ,
  paid_at                         TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_checkout_offers_request_id_idx
  ON public.sourcing_checkout_offers(sourcing_request_id);
CREATE INDEX IF NOT EXISTS sourcing_checkout_offers_status_idx
  ON public.sourcing_checkout_offers(status);
CREATE INDEX IF NOT EXISTS sourcing_checkout_offers_expires_at_idx
  ON public.sourcing_checkout_offers(expires_at)
  WHERE expires_at IS NOT NULL;

-- ── 7. Extend sourcing_credit_ledger ──────────────────────────────────────────
ALTER TABLE public.sourcing_credit_ledger
  DROP CONSTRAINT IF EXISTS sourcing_credit_ledger_event_type_check;

ALTER TABLE public.sourcing_credit_ledger
  ADD CONSTRAINT sourcing_credit_ledger_event_type_check
    CHECK (event_type IN (
      'credit_created','credit_consumed','credit_refunded',
      'credit_expired','credit_voided'
    ));

ALTER TABLE public.sourcing_credit_ledger
  ADD COLUMN IF NOT EXISTS sourcing_checkout_offer_id UUID
    REFERENCES public.sourcing_checkout_offers(id) ON DELETE SET NULL;
