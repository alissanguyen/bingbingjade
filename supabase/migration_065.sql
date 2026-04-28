-- migration_065: Remove label_cost_usd from total_cogs_usd
-- COGS covers item import costs only. Label cost is tracked separately.

ALTER TABLE product_costs DROP COLUMN total_cogs_usd;

ALTER TABLE product_costs ADD COLUMN total_cogs_usd numeric GENERATED ALWAYS AS (
  purchase_price_usd
  + import_cost_usd
  + certification_cost_usd
  + inbound_shipping_cost_usd
  + other_cost_usd
) STORED;
