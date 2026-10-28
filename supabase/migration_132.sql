-- Migration 132: widen orders.capture_payment_method to match what Stripe
-- actually reports for livestream checkouts
--
-- migration_101 constrained capture_payment_method to ('card', 'klarna',
-- 'afterpay_clearpay', 'affirm', 'zip') — the BNPL methods explicitly wired
-- into MANUAL_CAPTURE_WINDOW_DAYS. But the livestream checkout route
-- (app/api/livestream-checkout/[token]/checkout/route.ts) doesn't restrict
-- payment_method_types, so Stripe's payment method configuration also offers
-- Link, Cash App, and Amazon Pay. A buyer who pays with one of those gets a
-- PaymentIntent whose payment_method_types[0] is 'link'/'cashapp'/
-- 'amazon_pay' — a value this CHECK constraint rejects outright, so the
-- order insert in handleLivestreamCheckout (app/api/stripe/webhook/route.ts)
-- fails with a 23514 violation on every single webhook delivery attempt.
-- The buyer's payment is authorized in Stripe but no order is ever created,
-- silently losing the sale. Found via a real incident: a livestream buyer
-- who paid via Link had her $103.95 authorization sit with no order for
-- 4 days while Stripe retried the webhook 7 times, all identically failing.
--
-- These three methods don't have a documented manual-capture authorization
-- window the way BNPL methods do — the application code already falls back
-- to a 7-day (card-like) window for any payment method not present in
-- MANUAL_CAPTURE_WINDOW_DAYS, so no code change is needed there, only here.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_capture_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_capture_payment_method_check
  CHECK (capture_payment_method IN (
    'card', 'klarna', 'afterpay_clearpay', 'affirm', 'zip',
    'link', 'cashapp', 'amazon_pay'
  ));
