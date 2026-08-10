-- migration_119: Backfill missing product SKUs
--
-- migration_060 originally backfilled every product's SKU and made the
-- column UNIQUE, but two write paths added after that kept inserting
-- products with sku = NULL: the Catalog Contributor listing flow (its
-- app/employee/[employeeId]/add page passed sku="" instead of generating
-- one, and the employee field allowlist never captured/wrote it even when
-- present — fixed in application code alongside this migration) and a
-- handful of admin-created products from an April 2026 bulk-add path that
-- bypassed the normal /add form's SKU generation entirely.
--
-- By the time this ran, 190 products had sku IS NULL — 55 already
-- PUBLISHED, 121 AWAITING_APPROVAL, 1 REJECTED, 13 admin-created with no
-- listing_status at all. Same idempotent, collision-safe loop as
-- migration_060 (safe to run again on a fresh database with zero rows
-- affected, since this only ever touches sku IS NULL).

DO $$
DECLARE
  r RECORD;
  candidate char(8);
BEGIN
  FOR r IN SELECT id FROM products WHERE sku IS NULL LOOP
    LOOP
      candidate := lpad(floor(random() * 100000000)::bigint::text, 8, '0');
      BEGIN
        UPDATE products SET sku = candidate WHERE id = r.id;
        EXIT; -- success, no conflict
      EXCEPTION WHEN unique_violation THEN
        -- try again
      END;
    END LOOP;
  END LOOP;
END $$;
