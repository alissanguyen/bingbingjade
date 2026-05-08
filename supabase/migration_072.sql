-- Add 'giveaway' as a valid coupon_purpose value.
-- Dynamically drops any existing CHECK constraint on the coupon_purpose column,
-- then recreates it with the full set of allowed values.

DO $$
DECLARE
  _con text;
BEGIN
  -- Find any CHECK constraint on coupon_campaigns that references coupon_purpose
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'public.coupon_campaigns'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%coupon_purpose%';

  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.coupon_campaigns DROP CONSTRAINT %I', _con);
  END IF;
END;
$$;

ALTER TABLE public.coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_coupon_purpose_check
  CHECK (coupon_purpose IN ('thank_you', 'retention', 'giveaway'));
