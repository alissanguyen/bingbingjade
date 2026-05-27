-- Migration 083: Inventory Batches + Order-level Inventory Expense
-- Replaces the COGS approach with proper inventory batch tracking and
-- per-order expense attribution.

-- ─── 1. Inventory Batches ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  batch_code            text,
  vendor                text,
  purchase_date         date,
  received_date         date,
  status                text        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'in_transit', 'received', 'closed')),
  goods_cost_usd        numeric(12,2) NOT NULL DEFAULT 0,
  freight_cost_usd      numeric(12,2) NOT NULL DEFAULT 0,
  insurance_cost_usd    numeric(12,2) NOT NULL DEFAULT 0,
  duties_cost_usd       numeric(12,2) NOT NULL DEFAULT 0,
  certification_cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  misc_cost_usd         numeric(12,2) NOT NULL DEFAULT 0,
  total_batch_cost_usd  numeric(12,2) GENERATED ALWAYS AS (
    goods_cost_usd + freight_cost_usd + insurance_cost_usd +
    duties_cost_usd + certification_cost_usd + misc_cost_usd
  ) STORED,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ib_status_idx   ON public.inventory_batches (status);
CREATE INDEX IF NOT EXISTS ib_created_idx  ON public.inventory_batches (created_at DESC);

-- ─── 2. Inventory Batch Items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_batch_items (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                    uuid        NOT NULL REFERENCES public.inventory_batches(id) ON DELETE CASCADE,
  product_id                  uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  assigned_inventory_cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  allocation_method           text        NOT NULL DEFAULT 'manual'
                              CHECK (allocation_method IN ('manual', 'proportional', 'equal', 'legacy')),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ibi_batch_id_idx   ON public.inventory_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS ibi_product_id_idx ON public.inventory_batch_items (product_id);

-- ─── 3. Order-level Inventory Expense ────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inventory_expense_amount  numeric(12,2),
  ADD COLUMN IF NOT EXISTS inventory_expense_source  text
                           CHECK (inventory_expense_source IN
                             ('manual', 'batch_allocated', 'legacy_import_price', 'none')),
  ADD COLUMN IF NOT EXISTS inventory_expense_notes   text;

CREATE INDEX IF NOT EXISTS orders_expense_source_idx
  ON public.orders (inventory_expense_source)
  WHERE inventory_expense_source IS NOT NULL;

-- ─── 4. Products: inventory_type + batch link ─────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_type     text
                           CHECK (inventory_type IN ('available_now', 'sourced_for_you')),
  ADD COLUMN IF NOT EXISTS inventory_batch_id uuid
                           REFERENCES public.inventory_batches(id) ON DELETE SET NULL;

-- Make imported_price_vnd optional (was NOT NULL) — new products sourced via batch
-- won't have a per-product VND cost; cost is tracked at batch level instead.
ALTER TABLE public.products
  ALTER COLUMN imported_price_vnd DROP NOT NULL;

CREATE INDEX IF NOT EXISTS products_batch_id_idx
  ON public.products (inventory_batch_id)
  WHERE inventory_batch_id IS NOT NULL;
