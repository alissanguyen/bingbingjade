-- Migration 099: Add review_window_closed to orders
--
-- Allows admin to mark an order as no longer eligible for a customer review.
-- The customer portal hides the review section entirely when this is true.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_window_closed boolean NOT NULL DEFAULT false;
