-- ============================================================
-- migration_102: Store credit system (admin-issued, code-redeemed,
-- conditional credits — distinct from the older auto-applied
-- customers.store_credit_balance / store_credit_ledger system used
-- for referral rewards, which is untouched by this migration).
--
-- store_credits: one row per issued credit, with structured
-- eligibility conditions so the checkout/email condition wording is
-- always generated from data, never hand-typed.
--
-- store_credit_transactions: append-only ledger. remaining_amount_cents
-- on store_credits is a denormalized cache — it is only ever written
-- inside the RPC functions below, in the same transaction as the
-- ledger row, so the cached balance is always reconcilable against
-- the ledger.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_credits (
  id                                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                                text        NOT NULL UNIQUE,  -- e.g. BBJ-SC-AB12-CD34, stored uppercase
  customer_email                      text        NOT NULL,          -- normalized (lowercase, trimmed)
  customer_id                         uuid        REFERENCES public.customers(id),
  source_order_id                     uuid        REFERENCES public.orders(id),
  currency                            text        NOT NULL DEFAULT 'USD',
  original_amount_cents                integer     NOT NULL CHECK (original_amount_cents > 0),
  remaining_amount_cents               integer     NOT NULL CHECK (remaining_amount_cents >= 0),

  status                              text        NOT NULL DEFAULT 'active'
                                         CHECK (status IN ('active', 'fully_used', 'expired', 'revoked')),
  reason                              text        NOT NULL
                                         CHECK (reason IN (
                                           'goodwill_resolution',
                                           'canceled_order',
                                           'damaged_lost_package',
                                           'return',
                                           'price_adjustment',
                                           'loyalty_vip',
                                           'other'
                                         )),
  customer_message                    text,       -- optional, shown to the customer
  internal_note                       text,       -- never shown to the customer

  issued_at                           timestamptz NOT NULL DEFAULT now(),
  issued_by                           text        NOT NULL,          -- admin identifier, same convention as orders.created_by

  starts_at                           timestamptz,
  expires_at                          timestamptz,

  -- Eligibility conditions — all optional / all-null means "no restriction"
  minimum_merchandise_subtotal_cents  integer,
  maximum_line_items                  integer,
  eligible_fulfillment_types          text[]      CHECK (
                                         eligible_fulfillment_types IS NULL OR
                                         eligible_fulfillment_types <@ ARRAY['available_now','sourced_for_you']::text[]
                                       ),
  eligible_product_ids                uuid[],
  eligible_collection_ids             uuid[],
  excluded_product_ids                uuid[],
  exclude_sale_items                  boolean     NOT NULL DEFAULT false,
  exclude_clearance_items             boolean     NOT NULL DEFAULT false,
  allow_with_discount_codes           boolean     NOT NULL DEFAULT false,
  allow_with_other_store_credits      boolean     NOT NULL DEFAULT false,

  usage_mode                          text        NOT NULL DEFAULT 'reusable_until_balance_zero'
                                         CHECK (usage_mode IN ('single_use', 'reusable_until_balance_zero')),
  maximum_credit_per_order_cents      integer,
  maximum_credit_percentage           numeric(5,2) CHECK (maximum_credit_percentage IS NULL OR (maximum_credit_percentage > 0 AND maximum_credit_percentage <= 100)),

  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_credits_email_idx        ON public.store_credits (customer_email);
CREATE INDEX IF NOT EXISTS store_credits_customer_id_idx  ON public.store_credits (customer_id);
CREATE INDEX IF NOT EXISTS store_credits_source_order_idx ON public.store_credits (source_order_id);
CREATE INDEX IF NOT EXISTS store_credits_status_idx       ON public.store_credits (status);
-- Case-insensitive code lookup at checkout (code is stored uppercase, but index defensively)
CREATE INDEX IF NOT EXISTS store_credits_code_upper_idx   ON public.store_credits (upper(code));

CREATE OR REPLACE FUNCTION public._store_credits_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS store_credits_updated_at ON public.store_credits;
CREATE TRIGGER store_credits_updated_at
  BEFORE UPDATE ON public.store_credits
  FOR EACH ROW EXECUTE FUNCTION public._store_credits_set_updated_at();

-- RLS: financial data, service-role only (same pattern as customers/order_payments) —
-- never publicly readable, never validated client-side.
ALTER TABLE public.store_credits ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only.

-- ── Ledger ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.store_credit_transactions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_credit_id     uuid        NOT NULL REFERENCES public.store_credits(id),
  order_id            uuid        REFERENCES public.orders(id),
  checkout_reference  text,       -- reservation token / Stripe session metadata key while pending
  transaction_type    text        NOT NULL
                         CHECK (transaction_type IN (
                           'issued', 'reserved', 'reservation_released', 'redeemed',
                           'restored', 'adjusted', 'revoked', 'expired'
                         )),
  amount_cents        integer     NOT NULL,   -- signed: positive = credit added/restored, negative = deducted
  balance_before_cents integer    NOT NULL,
  balance_after_cents  integer    NOT NULL,
  reason              text,
  created_by           text,       -- admin identifier, or 'system' / 'checkout'
  created_at           timestamptz NOT NULL DEFAULT now(),
  metadata             jsonb
);

CREATE INDEX IF NOT EXISTS store_credit_txns_credit_idx      ON public.store_credit_transactions (store_credit_id);
CREATE INDEX IF NOT EXISTS store_credit_txns_order_idx       ON public.store_credit_transactions (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_credit_txns_checkout_ref_idx ON public.store_credit_transactions (checkout_reference) WHERE checkout_reference IS NOT NULL;
-- Only one live (unreleased/unredeemed) reservation per checkout reference
CREATE UNIQUE INDEX IF NOT EXISTS store_credit_txns_active_reservation_idx
  ON public.store_credit_transactions (checkout_reference)
  WHERE transaction_type = 'reserved';

ALTER TABLE public.store_credit_transactions ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only.

-- ── Orders: store-credit tender fields ────────────────────────────────────────
-- Store credit is a distinct payment method, never mixed into
-- discount_source / discount_amount_cents (those remain promotional-
-- discount-only, unchanged).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_credit_id            uuid REFERENCES public.store_credits(id),
  ADD COLUMN IF NOT EXISTS store_credit_used_cents     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchandise_subtotal_cents  integer,
  ADD COLUMN IF NOT EXISTS stripe_amount_cents         integer;

CREATE INDEX IF NOT EXISTS orders_store_credit_id_idx
  ON public.orders (store_credit_id)
  WHERE store_credit_id IS NOT NULL;

-- ============================================================
-- RPC functions — first use of SELECT ... FOR UPDATE in this codebase.
-- All SECURITY DEFINER so they run with the privileges of the function
-- owner (service role), matching next_order_number()'s existing pattern.
-- Only ever called from supabaseAdmin.rpc(...) — never exposed to anon.
-- ============================================================

-- Reserve credit for an in-flight checkout. Returns the new transaction id,
-- or NULL if the balance is insufficient (caller checks for NULL).
CREATE OR REPLACE FUNCTION public.reserve_store_credit(
  p_store_credit_id   uuid,
  p_amount_cents       integer,
  p_checkout_reference text,
  p_created_by         text DEFAULT 'checkout'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_txn_id  uuid;
BEGIN
  SELECT remaining_amount_cents INTO v_balance
  FROM public.store_credits
  WHERE id = p_store_credit_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount_cents THEN
    RETURN NULL;
  END IF;

  UPDATE public.store_credits
  SET remaining_amount_cents = remaining_amount_cents - p_amount_cents
  WHERE id = p_store_credit_id;

  INSERT INTO public.store_credit_transactions (
    store_credit_id, checkout_reference, transaction_type,
    amount_cents, balance_before_cents, balance_after_cents,
    created_by
  ) VALUES (
    p_store_credit_id, p_checkout_reference, 'reserved',
    -p_amount_cents, v_balance, v_balance - p_amount_cents,
    p_created_by
  )
  RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$$;

-- Release a still-live reservation (checkout expired / payment failed /
-- customer removed the code before paying). Idempotent — no-op if no
-- live reservation exists for that reference.
CREATE OR REPLACE FUNCTION public.release_store_credit_reservation(
  p_checkout_reference text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_balance     integer;
BEGIN
  SELECT * INTO v_reservation
  FROM public.store_credit_transactions
  WHERE checkout_reference = p_checkout_reference
    AND transaction_type = 'reserved'
  LIMIT 1;

  IF v_reservation IS NULL THEN
    RETURN false;
  END IF;

  SELECT remaining_amount_cents INTO v_balance
  FROM public.store_credits
  WHERE id = v_reservation.store_credit_id
  FOR UPDATE;

  UPDATE public.store_credits
  SET remaining_amount_cents = remaining_amount_cents + (-v_reservation.amount_cents)
  WHERE id = v_reservation.store_credit_id;

  INSERT INTO public.store_credit_transactions (
    store_credit_id, order_id, checkout_reference, transaction_type,
    amount_cents, balance_before_cents, balance_after_cents, created_by
  ) VALUES (
    v_reservation.store_credit_id, NULL, p_checkout_reference, 'reservation_released',
    -v_reservation.amount_cents, v_balance, v_balance + (-v_reservation.amount_cents),
    'system'
  );

  RETURN true;
END;
$$;

-- Convert a live reservation into a redemption once the order is
-- confirmed (balance was already deducted at reservation time — this
-- just relabels the transaction and attaches the order). Forfeits any
-- remaining balance for single_use credits per the ticket's explicit
-- forfeiture rule.
CREATE OR REPLACE FUNCTION public.redeem_store_credit_reservation(
  p_checkout_reference text,
  p_order_id           uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_credit      RECORD;
  v_balance     integer;
BEGIN
  SELECT * INTO v_reservation
  FROM public.store_credit_transactions
  WHERE checkout_reference = p_checkout_reference
    AND transaction_type = 'reserved'
  LIMIT 1;

  IF v_reservation IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_credit
  FROM public.store_credits
  WHERE id = v_reservation.store_credit_id
  FOR UPDATE;

  UPDATE public.store_credit_transactions
  SET transaction_type = 'redeemed', order_id = p_order_id
  WHERE id = v_reservation.id;

  v_balance := v_credit.remaining_amount_cents;

  IF v_balance = 0 THEN
    UPDATE public.store_credits SET status = 'fully_used' WHERE id = v_credit.id;
  ELSIF v_balance > 0 AND v_credit.usage_mode = 'single_use' THEN
    -- Forfeit any dust remainder for single-use credits.
    INSERT INTO public.store_credit_transactions (
      store_credit_id, order_id, transaction_type,
      amount_cents, balance_before_cents, balance_after_cents, created_by, reason
    ) VALUES (
      v_credit.id, p_order_id, 'adjusted',
      -v_balance, v_balance, 0, 'system', 'Single-use credit — remaining balance forfeited after redemption'
    );
    UPDATE public.store_credits
    SET remaining_amount_cents = 0, status = 'fully_used'
    WHERE id = v_credit.id;
  END IF;

  RETURN true;
END;
$$;

-- Restore credit on cancellation/refund, capped at the amount originally
-- redeemed for that order (never exceeds it, never goes negative).
CREATE OR REPLACE FUNCTION public.restore_store_credit(
  p_store_credit_id uuid,
  p_amount_cents     integer,
  p_order_id         uuid,
  p_reason           text DEFAULT NULL,
  p_created_by       text DEFAULT 'system'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT remaining_amount_cents INTO v_balance
  FROM public.store_credits
  WHERE id = p_store_credit_id
  FOR UPDATE;

  IF v_balance IS NULL OR p_amount_cents <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.store_credits
  SET remaining_amount_cents = remaining_amount_cents + p_amount_cents,
      status = CASE WHEN status = 'fully_used' THEN 'active' ELSE status END
  WHERE id = p_store_credit_id;

  INSERT INTO public.store_credit_transactions (
    store_credit_id, order_id, transaction_type,
    amount_cents, balance_before_cents, balance_after_cents, created_by, reason
  ) VALUES (
    p_store_credit_id, p_order_id, 'restored',
    p_amount_cents, v_balance, v_balance + p_amount_cents, p_created_by, p_reason
  );

  RETURN true;
END;
$$;

-- Admin manual balance adjustment. Never allows the balance to go
-- negative, and never allows cumulative positive adjustments + issued
-- amount to be exceeded by what's actually redeemable (the running
-- remaining_amount_cents check below is the enforcement — a negative
-- delta simply cannot take it below zero).
CREATE OR REPLACE FUNCTION public.adjust_store_credit_balance(
  p_store_credit_id uuid,
  p_delta_cents      integer,
  p_reason           text,
  p_created_by       text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_new     integer;
BEGIN
  SELECT remaining_amount_cents INTO v_balance
  FROM public.store_credits
  WHERE id = p_store_credit_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN false;
  END IF;

  v_new := v_balance + p_delta_cents;
  IF v_new < 0 THEN
    RETURN false;
  END IF;

  UPDATE public.store_credits
  SET remaining_amount_cents = v_new,
      status = CASE
        WHEN v_new = 0 THEN 'fully_used'
        WHEN status = 'fully_used' AND v_new > 0 THEN 'active'
        ELSE status
      END
  WHERE id = p_store_credit_id;

  INSERT INTO public.store_credit_transactions (
    store_credit_id, transaction_type,
    amount_cents, balance_before_cents, balance_after_cents, created_by, reason
  ) VALUES (
    p_store_credit_id, 'adjusted',
    p_delta_cents, v_balance, v_new, p_created_by, p_reason
  );

  RETURN true;
END;
$$;
