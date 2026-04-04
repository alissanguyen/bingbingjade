-- Migration 044: Sourcing attempt tracking + private checkout support
-- Adds timing columns, expands sourcing_status values, adds private checkout fields.

-- ── 1. Expand sourcing_status CHECK constraint ────────────────────────────────
-- Must drop and re-add the inline CHECK (PostgreSQL doesn't support ALTER CONSTRAINT).
ALTER TABLE public.sourcing_requests
  DROP CONSTRAINT IF EXISTS sourcing_requests_sourcing_status_check;

ALTER TABLE public.sourcing_requests
  ADD CONSTRAINT sourcing_requests_sourcing_status_check
    CHECK (sourcing_status IN (
      'queued',
      'options_sent',
      'in_progress',
      'accepted_pending_checkout',
      'checkout_expired',
      'fulfilled',
      'cancelled'
    ));

-- ── 2. Attempt-tracking columns ───────────────────────────────────────────────
ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS last_attempt_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_response_due_at timestamptz,  -- last_attempt_sent_at + 72h
  ADD COLUMN IF NOT EXISTS final_attempt_sent_at        timestamptz;  -- set when admin marks final

-- When final_attempt_sent_at is set, credit_expires_at is overridden to
-- final_attempt_sent_at + 7 days (via mark-attempt API). The column already exists.

-- ── 3. Private checkout columns ───────────────────────────────────────────────
ALTER TABLE public.sourcing_requests
  ADD COLUMN IF NOT EXISTS accepted_checkout_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS private_checkout_session_id   text,
  ADD COLUMN IF NOT EXISTS private_checkout_url          text,
  ADD COLUMN IF NOT EXISTS private_checkout_amount_cents integer;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sourcing_requests_private_checkout_session
  ON public.sourcing_requests(private_checkout_session_id)
  WHERE private_checkout_session_id IS NOT NULL;
