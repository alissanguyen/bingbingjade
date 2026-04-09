-- migration_048: add cogs_cents to orders for profit tracking
--
-- Stores cost of goods sold in USD cents at time of purchase,
-- converted from imported_price_vnd at a fixed rate of 1 USD = 26,000 VND.
-- Only populated for server-side Stripe webhook inserts — never exposed to clients.

ALTER TABLE orders ADD COLUMN cogs_cents integer;
