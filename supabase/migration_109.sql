-- Migration 109: Listing approval credits (employee compensation, per unique product)
--
-- The UNIQUE constraint on product_id is the core anti-double-pay guarantee:
-- a product can receive at most one compensation credit no matter how many
-- submission versions/resubmissions/admin re-reviews it goes through. Rate
-- is snapshotted at approval time (rate_at_approval) so later pay-rate
-- changes never retroactively affect already-approved listings.

CREATE TABLE IF NOT EXISTS listing_approval_credits (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id             UUID        NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  employee_id            UUID        NOT NULL REFERENCES approved_users(id) ON DELETE RESTRICT,
  approved_by_admin_id   TEXT        NOT NULL,
  approved_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_at_approval       NUMERIC(10,2) NOT NULL,
  payout_status          TEXT        NOT NULL DEFAULT 'unpaid'
                          CHECK (payout_status IN ('unpaid', 'scheduled', 'paid')),
  payout_id              UUID,
  revoked_at             TIMESTAMPTZ,
  revocation_reason      TEXT,
  revocation_employee_note TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (revoked_at IS NULL OR revocation_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_listing_approval_credits_employee_id ON listing_approval_credits(employee_id);
CREATE INDEX IF NOT EXISTS idx_listing_approval_credits_payout_id ON listing_approval_credits(payout_id);
CREATE INDEX IF NOT EXISTS idx_listing_approval_credits_payout_status ON listing_approval_credits(payout_status);

ALTER TABLE listing_approval_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON listing_approval_credits USING (false) WITH CHECK (false);
