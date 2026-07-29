-- Migration 115: Allow employee-created products without a vendor
--
-- products.vendor_id has been NOT NULL since the original schema — every
-- product was sourced through a known vendor. Employee-created listings
-- (created_by_employee_id IS NOT NULL) don't have a vendor at creation time;
-- an admin can attach one later during review if relevant. Existing rows and
-- every other write path are unaffected — this only relaxes the constraint,
-- it doesn't change behavior for admin/partner-created products, which
-- continue to always supply a vendor_id.

ALTER TABLE public.products
  ALTER COLUMN vendor_id DROP NOT NULL;
