-- Add status column to products
ALTER TABLE products
  ADD COLUMN status text NOT NULL DEFAULT 'available'
  CHECK (status IN ('available', 'sold'));
