-- migration_124: Track store-credit-issued-as-refund adjustments in accounting_summaries
--
-- When a store credit is issued in place of a monetary refund on an already-
-- paid order (reason: canceled_order / damaged_lost_package / return, with
-- source_order_id set), that source order's revenue was already recognized
-- once. If the credit is later redeemed on a different order, that new
-- order's full amount_total is recognized as revenue too — double-counting
-- the credited amount unless something backs it out.
--
-- store_credit_refund_adjustments holds, per period (bucketed by the
-- credit's issued_at, matching how gross_sales buckets by order.created_at),
-- the sum of original_amount_cents for such credits. It's subtracted from
-- gross_sales at write time (see full-accounting/summary/route.ts) and kept
-- as its own column — same pattern as `discounts` — so the adjustment stays
-- auditable instead of silently disappearing into gross_sales.
ALTER TABLE accounting_summaries
  ADD COLUMN store_credit_refund_adjustments numeric(12,2) NOT NULL DEFAULT 0;
