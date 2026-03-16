-- Add 'on_sale' to status check constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('available', 'sold', 'on_sale'));
