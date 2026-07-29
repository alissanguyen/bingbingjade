-- Migration 110: Employee payouts
--
-- A payout covers a custom [period_start, period_end] date range for one
-- employee. employee_payout_items pins the exact approval-credit rows (and
-- therefore product IDs) included, so a payout's contents are retained even
-- if later credits are created/revoked. Once a payout's status is 'paid',
-- application code (never this migration) locks its items and marks the
-- included credits paid — see fn_mark_payout_paid semantics in migration_113.

CREATE TABLE IF NOT EXISTS employee_payouts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID        NOT NULL REFERENCES approved_users(id) ON DELETE RESTRICT,
  period_start            DATE        NOT NULL,
  period_end              DATE        NOT NULL,
  approved_listing_count  INT         NOT NULL DEFAULT 0,
  gross_listing_pay       NUMERIC(10,2) NOT NULL DEFAULT 0,
  bonus_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  adjustment_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  deduction_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount            NUMERIC(10,2) GENERATED ALWAYS AS (
    gross_listing_pay + bonus_amount + adjustment_amount - deduction_amount
  ) STORED,
  payment_method          TEXT        CHECK (payment_method IS NULL OR payment_method IN
                            ('ACH', 'ZELLE', 'PAYPAL', 'CHECK', 'CASH', 'OTHER')),
  scheduled_pay_date      DATE,
  actual_paid_date        DATE,
  status                  TEXT        NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT', 'SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED')),
  payment_reference       TEXT,
  private_admin_notes     TEXT,
  created_by_admin_id     TEXT        NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_employee_payouts_employee_id ON employee_payouts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payouts_status ON employee_payouts(status);

ALTER TABLE employee_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON employee_payouts USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS employee_payout_items (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id          UUID        NOT NULL REFERENCES employee_payouts(id) ON DELETE CASCADE,
  approval_credit_id UUID        NOT NULL UNIQUE REFERENCES listing_approval_credits(id) ON DELETE RESTRICT,
  product_id         UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  amount             NUMERIC(10,2) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_payout_items_payout_id ON employee_payout_items(payout_id);

ALTER TABLE employee_payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON employee_payout_items USING (false) WITH CHECK (false);

-- Now that employee_payouts exists, wire up the credit -> payout reference.
ALTER TABLE listing_approval_credits
  ADD CONSTRAINT fk_listing_approval_credits_payout
  FOREIGN KEY (payout_id) REFERENCES employee_payouts(id) ON DELETE SET NULL;
