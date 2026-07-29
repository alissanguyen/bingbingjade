-- Migration 106: Products — employee-authored listing tracking
--
-- Adds employee attribution and a separate editorial workflow status to
-- products, additive to (not replacing) the existing `is_published` /
-- `pending_approval` / `pending_data` columns used by the legacy partner
-- approve flow. `listing_status` is only meaningful when
-- `created_by_employee_id IS NOT NULL` — every pre-existing row gets NULL,
-- so the storefront (which gates solely on `is_published`), search,
-- pagination, and the legacy partner approval flow are completely
-- unaffected by this migration.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_by_employee_id UUID REFERENCES approved_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listing_status TEXT
    CHECK (listing_status IS NULL OR listing_status IN (
      'EMPLOYEE_DRAFT',
      'AWAITING_APPROVAL',
      'NEEDS_ADJUSTMENT',
      'APPROVED_UNPUBLISHED',
      'PUBLISHED',
      'REJECTED',
      'ARCHIVED'
    )),
  ADD COLUMN IF NOT EXISTS current_submission_version INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_created_by_employee_id ON public.products(created_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_products_listing_status ON public.products(listing_status) WHERE listing_status IS NOT NULL;
