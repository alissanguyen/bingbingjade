-- Migration 090: Expense vendor and payment method lookup tables
-- Separate from `vendors` (jade sourcing) and `acct_vendors` (COGS contacts).
-- These track business vendors (Temu, Amazon, shipping carriers, etc.)
-- and payment methods (cards, Zelle accounts, etc.) used in business_expenses.

CREATE TABLE IF NOT EXISTS expense_vendors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expense_vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin service role only" ON expense_vendors         USING (false) WITH CHECK (false);
CREATE POLICY "Admin service role only" ON expense_payment_methods USING (false) WITH CHECK (false);

-- Seed from existing expenses so history is immediately searchable
INSERT INTO expense_vendors (name)
SELECT DISTINCT trim(vendor) FROM business_expenses
WHERE vendor IS NOT NULL AND trim(vendor) != ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_payment_methods (name)
SELECT DISTINCT trim(payment_method) FROM business_expenses
WHERE payment_method IS NOT NULL AND trim(payment_method) != ''
ON CONFLICT (name) DO NOTHING;
