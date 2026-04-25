-- migration_054: Accounting dashboard tables
-- Creates: acct_vendors, product_costs, order_fulfillment_costs,
--          business_expenses, stripe_accounting_snapshots

-- ── 1. Accounting vendors ─────────────────────────────────────────────────────
-- Separate from the existing `vendors` table (which tracks jade sourcing contacts).
-- This table tracks suppliers for accounting/expense purposes.

CREATE TABLE acct_vendors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code         text UNIQUE NOT NULL,
  vendor_display_name text,
  real_name           text,
  country             text,
  contact_info        text,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE acct_vendors ENABLE ROW LEVEL SECURITY;
-- Admin-only via service role key; no public access
CREATE POLICY "Admin service role only" ON acct_vendors USING (false) WITH CHECK (false);

-- ── 2. Product costs (COGS per product) ───────────────────────────────────────

CREATE TABLE product_costs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                  uuid UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  vendor_id                   uuid REFERENCES acct_vendors(id) ON DELETE SET NULL,
  purchase_price_original     numeric NOT NULL DEFAULT 0,
  purchase_currency           text    NOT NULL DEFAULT 'USD',
  exchange_rate_to_usd        numeric NOT NULL DEFAULT 1,
  purchase_price_usd          numeric NOT NULL DEFAULT 0,
  import_cost_usd             numeric NOT NULL DEFAULT 0,
  certification_cost_usd      numeric NOT NULL DEFAULT 0,
  inbound_shipping_cost_usd   numeric NOT NULL DEFAULT 0,
  other_cost_usd              numeric NOT NULL DEFAULT 0,
  -- Auto-calculated total COGS
  total_cogs_usd              numeric GENERATED ALWAYS AS (
    purchase_price_usd
    + import_cost_usd
    + certification_cost_usd
    + inbound_shipping_cost_usd
    + other_cost_usd
  ) STORED,
  cost_last_updated_at        timestamptz DEFAULT now(),
  notes                       text,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX ON product_costs(product_id);
CREATE INDEX ON product_costs(vendor_id);

ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON product_costs USING (false) WITH CHECK (false);

-- ── 3. Order fulfillment costs ────────────────────────────────────────────────

CREATE TABLE order_fulfillment_costs (
  id                                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                              uuid UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  label_cost_usd                        numeric NOT NULL DEFAULT 0,
  business_shipping_insurance_cost_usd  numeric NOT NULL DEFAULT 0,
  supplies_cost_usd                     numeric NOT NULL DEFAULT 20,
  dropoff_transport_cost_usd            numeric NOT NULL DEFAULT 0,
  other_fulfillment_cost_usd            numeric NOT NULL DEFAULT 0,
  notes                                 text,
  created_at                            timestamptz DEFAULT now(),
  updated_at                            timestamptz DEFAULT now()
);

CREATE INDEX ON order_fulfillment_costs(order_id);

ALTER TABLE order_fulfillment_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON order_fulfillment_costs USING (false) WITH CHECK (false);

-- ── 4. Business expenses ──────────────────────────────────────────────────────

CREATE TABLE business_expenses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date          date    NOT NULL,
  vendor                text,
  category              text    NOT NULL CHECK (category IN (
    'software', 'ads', 'equipment', 'licenses', 'domain',
    'office', 'supplies', 'shipping', 'professional_services', 'other'
  )),
  amount_usd            numeric NOT NULL,
  payment_method        text,
  receipt_url           text,
  business_use_percent  numeric NOT NULL DEFAULT 100,
  deductible_amount_usd numeric GENERATED ALWAYS AS (
    amount_usd * business_use_percent / 100
  ) STORED,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX ON business_expenses(expense_date);
CREATE INDEX ON business_expenses(category);

ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON business_expenses USING (false) WITH CHECK (false);

-- ── 5. Stripe accounting snapshots (cache) ────────────────────────────────────
-- Avoids repeated Stripe API calls. Synced via admin "Sync Stripe Data" button.

CREATE TABLE stripe_accounting_snapshots (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id  text UNIQUE,
  stripe_session_id         text,
  order_id                  uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- All amounts in cents (USD)
  amount_total_cents        integer,
  amount_subtotal_cents     integer,
  amount_shipping_cents     integer,
  amount_tax_cents          integer,
  amount_discount_cents     integer,
  stripe_fee_cents          integer,
  stripe_net_cents          integer,
  refunded_amount_cents     integer DEFAULT 0,
  stripe_currency           text DEFAULT 'usd',
  stripe_status             text,
  stripe_created_at         timestamptz,
  synced_at                 timestamptz DEFAULT now(),
  raw_balance_txn_id        text,
  raw_data                  jsonb
);

CREATE INDEX ON stripe_accounting_snapshots(order_id);
CREATE INDEX ON stripe_accounting_snapshots(stripe_session_id);
CREATE INDEX ON stripe_accounting_snapshots(stripe_created_at);

ALTER TABLE stripe_accounting_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON stripe_accounting_snapshots USING (false) WITH CHECK (false);
