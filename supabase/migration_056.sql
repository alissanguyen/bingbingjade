-- migration_056: Universal payment ledger
-- Anchors all payment methods (Stripe, PayPal, Zelle, bank, cash, other)
-- to BBJ-XXXX order codes. Stripe data is still kept in stripe_accounting_snapshots
-- for raw Stripe fields; order_payments is the canonical payment ledger for P&L.

CREATE TABLE order_payments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid        REFERENCES orders(id) ON DELETE SET NULL,
  bbj_order_code          text,               -- copy of orders.order_number (BBJ-XXXX)
  payment_provider        text        NOT NULL CHECK (payment_provider IN ('stripe','paypal','zelle','bank_transfer','cash','other')),
  payment_type            text        NOT NULL DEFAULT 'checkout' CHECK (payment_type IN ('checkout','invoice','manual','deposit','balance_payment','partial_payment','refund')),
  provider_transaction_id text,               -- Stripe PI id, PayPal txn id, Zelle confirmation #
  provider_receipt_id     text,               -- Stripe receipt URL, PayPal receipt id
  provider_invoice_id     text,               -- PayPal invoice id, internal invoice ref
  amount_paid_usd         numeric(12,2) NOT NULL,
  currency                text        NOT NULL DEFAULT 'USD',
  payment_fee_usd         numeric(12,2) NOT NULL DEFAULT 0,   -- Stripe fee / PayPal fee / 0 for Zelle
  net_received_usd        numeric(12,2) NOT NULL,             -- amount_paid_usd - payment_fee_usd
  payment_date            timestamptz NOT NULL,
  payment_status          text        NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending','paid','partially_refunded','refunded','failed')),
  proof_url               text,               -- screenshot URL or paste URL
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Common lookup indexes
CREATE INDEX ON order_payments(order_id);
CREATE INDEX ON order_payments(bbj_order_code);
CREATE INDEX ON order_payments(payment_provider);
CREATE INDEX ON order_payments(payment_date);
CREATE INDEX ON order_payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX ON order_payments(provider_receipt_id)     WHERE provider_receipt_id     IS NOT NULL;
CREATE INDEX ON order_payments(provider_invoice_id)     WHERE provider_invoice_id     IS NOT NULL;

-- Idempotent upsert target for Stripe sync: (provider, txn_id) is unique when txn_id is not null
CREATE UNIQUE INDEX order_payments_stripe_unique
  ON order_payments(payment_provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Auto-touch updated_at
CREATE OR REPLACE FUNCTION _order_payments_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION _order_payments_set_updated_at();

-- RLS: accessible only via service role key (same pattern as accounting tables)
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON order_payments USING (false) WITH CHECK (false);
