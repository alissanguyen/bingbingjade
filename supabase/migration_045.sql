-- Migration 045: Add concierge tier to sourcing_requests
-- Expands request_type CHECK constraint and updates scoring constants.

ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_request_type_check;

ALTER TABLE public.sourcing_requests
  ADD CONSTRAINT sourcing_requests_request_type_check
    CHECK (request_type IN ('standard', 'premium', 'concierge'));
