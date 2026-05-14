-- migration_076: add 'campaign_event' to discount_source allowed values on orders
--
-- The campaign_event discount source was added in lib/discount.ts when campaign
-- events were built (migration_074), but the CHECK constraint on orders.discount_source
-- (added in migration_030) was never updated to include it.
--
-- Any order where a customer applied a campaign event coupon code would fail the
-- constraint and the Stripe webhook would return 500, preventing order creation.

DO $$
DECLARE
  _con text;
BEGIN
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%discount_source%';

  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', _con);
  END IF;
END;
$$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_source_check
  CHECK (discount_source IN ('welcome', 'referral', 'campaign', 'campaign_event', 'store_credit'));
