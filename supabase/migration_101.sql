-- ============================================================
-- migration_101: Track which payment method was used for a
-- manual-capture (Sourced for You) authorization.
--
-- Needed because Klarna/Afterpay/Affirm all support Stripe manual
-- capture (verified — see BNPL manual-capture investigation), each
-- with a different authorization window (card 7d, Klarna 28d,
-- Afterpay/Clearpay 13d, Affirm 30d). The checkout session can offer
-- multiple BNPL methods at once; we only learn which one the customer
-- actually chose once the webhook reads the confirmed PaymentIntent,
-- so we store it to explain the authorization_expires_at estimate and
-- to show it on the admin Payment card.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS capture_payment_method text
    CHECK (capture_payment_method IN ('card', 'klarna', 'afterpay_clearpay', 'affirm', 'zip'));
