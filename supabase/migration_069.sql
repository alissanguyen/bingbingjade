-- Add cancellation_reason to orders so the tracking page can show a tailored message
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_reason text
    CHECK (cancellation_reason IN ('piece_unavailable', 'customer_cancelled'));
