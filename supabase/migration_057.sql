-- migration_057: Accounting summaries cache table
-- Pre-computed P&L per month/quarter/year to avoid full-scan recomputation on every load.
-- A "Recalculate" button in the admin triggers a POST to /api/admin/full-accounting/summary.

CREATE TABLE accounting_summaries (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type         text        NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_label        text        NOT NULL,     -- '2026-01', '2026-Q2', '2026'
  period_year         int         NOT NULL,
  period_quarter      int         CHECK (period_quarter BETWEEN 1 AND 4),  -- null for month/year
  period_month        int         CHECK (period_month  BETWEEN 1 AND 12),  -- null for quarter/year
  -- Revenue side (from orders.created_at)
  gross_sales         numeric(12,2) NOT NULL DEFAULT 0,
  discounts           numeric(12,2) NOT NULL DEFAULT 0,
  tax_collected       numeric(12,2) NOT NULL DEFAULT 0,
  -- Cash side (from order_payments.payment_date)
  cash_received       numeric(12,2) NOT NULL DEFAULT 0,
  payment_fees        numeric(12,2) NOT NULL DEFAULT 0,
  net_cash_received   numeric(12,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,  -- gross_sales - cash_received
  -- Costs (by order.created_at for COGS/fulfillment, expense_date for expenses)
  cogs                numeric(12,2) NOT NULL DEFAULT 0,
  fulfillment_costs   numeric(12,2) NOT NULL DEFAULT 0,
  business_expenses   numeric(12,2) NOT NULL DEFAULT 0,
  -- Bottom line
  estimated_profit    numeric(12,2) NOT NULL DEFAULT 0,
  -- Order counts
  order_count         int          NOT NULL DEFAULT 0,
  paid_order_count    int          NOT NULL DEFAULT 0,
  unpaid_order_count  int          NOT NULL DEFAULT 0,
  partial_order_count int          NOT NULL DEFAULT 0,
  -- Metadata
  last_calculated_at  timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(period_type, period_label)
);

CREATE INDEX ON accounting_summaries(period_year, period_type);
CREATE INDEX ON accounting_summaries(period_type, period_label);

ALTER TABLE accounting_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON accounting_summaries USING (false) WITH CHECK (false);
