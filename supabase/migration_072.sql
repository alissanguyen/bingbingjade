-- Add 'giveaway' as a valid coupon_purpose value.
-- Drop old CHECK constraint and recreate with the new value.

ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_coupon_purpose_check;

ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_coupon_purpose_check
  CHECK (coupon_purpose IN ('thank_you', 'retention', 'giveaway'));
