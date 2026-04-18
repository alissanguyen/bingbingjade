-- migration_049: Add missing email tracking columns to coupon_campaigns
-- These columns are referenced by the cron job and API routes but were never migrated.

ALTER TABLE public.coupon_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_send_at  timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reminder1_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder2_sent_at  timestamptz;

-- Index for efficient cron queries
CREATE INDEX IF NOT EXISTS coupon_campaigns_scheduled_send_idx
  ON public.coupon_campaigns (scheduled_send_at)
  WHERE scheduled_send_at IS NOT NULL AND email_sent_at IS NULL;
