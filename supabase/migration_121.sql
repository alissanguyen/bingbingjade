-- migration_121: Multi-installment reservation deposits + correct accounting linkage.
--
-- product_reservations previously supported exactly one deposit
-- (deposit_amount_usd/deposit_paid, singular). This adds a child table so a
-- reservation can be paid off in any number of installments, and links the
-- eventual order back to the reservation so its payment history (and
-- orders.amount_total) can be backfilled correctly at sale time.
--
-- The old singular deposit_amount_usd/deposit_paid/deposit_stripe_session_id/
-- deposit_payment_intent_id columns on product_reservations are left in place
-- (additive-only convention) but are no longer written by new code.

CREATE TABLE IF NOT EXISTS public.reservation_deposit_payments (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id              uuid          NOT NULL REFERENCES public.product_reservations(id) ON DELETE CASCADE,
  amount_usd                  numeric(10,2) NOT NULL CHECK (amount_usd > 0),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  paid_at                     timestamptz   NOT NULL,
  created_at                  timestamptz   NOT NULL DEFAULT now()
);

-- Idempotency: a given Stripe checkout session can only ever record one deposit payment.
CREATE UNIQUE INDEX IF NOT EXISTS reservation_deposit_payments_session_idx
  ON public.reservation_deposit_payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reservation_deposit_payments_reservation_id_idx
  ON public.reservation_deposit_payments (reservation_id);

ALTER TABLE public.reservation_deposit_payments ENABLE ROW LEVEL SECURITY;

-- Links a finalized order back to the reservation that funded it (via deposits),
-- and records how much of the order's total was already collected as deposits —
-- mirrors the existing store_credit_used_cents pattern exactly.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.product_reservations(id),
  ADD COLUMN IF NOT EXISTS reservation_deposit_credit_cents integer NOT NULL DEFAULT 0;

-- Marks a reservation as fulfilled (converted into a real order) without
-- cancelling/deleting it, so it drops out of "pending reservation" views
-- while keeping its deposit history intact.
ALTER TABLE public.product_reservations
  ADD COLUMN IF NOT EXISTS converted_order_id uuid REFERENCES public.orders(id);
