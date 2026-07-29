-- Migration 107: Admin-only product financials
--
-- Final sale price already lives on products.price_display_usd /
-- sale_price_usd and stays there (storefront/checkout/search read it in too
-- many places to safely relocate). This table holds only the fields that
-- don't exist anywhere yet and must never be queried or serialized by any
-- employee-facing code path: minimum acceptable price, fee/profit/margin
-- estimates, and private admin notes tied to a listing review.

CREATE TABLE IF NOT EXISTS admin_product_financials (
  product_id           UUID        PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  minimum_price         NUMERIC(10,2),
  estimated_fees        NUMERIC(10,2),
  estimated_profit      NUMERIC(10,2),
  estimated_margin      NUMERIC(6,3),
  private_admin_notes   TEXT,
  updated_by_admin_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_product_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON admin_product_financials USING (false) WITH CHECK (false);
