-- migration_064: Add label_cost_usd to product_costs
-- NOTE: This mistakenly included label_cost_usd in total_cogs_usd.
-- Fixed by migration_065.

ALTER TABLE product_costs ADD COLUMN label_cost_usd numeric NOT NULL DEFAULT 0;

ALTER TABLE product_costs DROP COLUMN total_cogs_usd;

ALTER TABLE product_costs ADD COLUMN total_cogs_usd numeric GENERATED ALWAYS AS (
  purchase_price_usd
  + import_cost_usd
  + certification_cost_usd
  + inbound_shipping_cost_usd
  + other_cost_usd
  + label_cost_usd
) STORED;
