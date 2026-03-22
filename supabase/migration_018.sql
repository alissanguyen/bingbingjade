-- migration_018: widen imported_price_vnd from integer to bigint
--
-- PostgreSQL integer max is ~2.1 billion. High-value jade pieces imported at
-- e.g. 3,200,000,000 VND (~$125 USD) overflow that limit. bigint holds up to
-- ~9.2 quadrillion, which is safely beyond any realistic VND amount.

ALTER TABLE products
  ALTER COLUMN imported_price_vnd TYPE bigint;
