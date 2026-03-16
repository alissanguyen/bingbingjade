-- Add sale_price_usd for products marked on_sale
ALTER TABLE products
  ADD COLUMN sale_price_usd numeric(10,2) DEFAULT NULL;
