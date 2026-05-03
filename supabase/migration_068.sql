-- migration_068: Soft-delete unsubscribes to prevent coupon re-issuance abuse
--
-- Previously, unsubscribing hard-deleted the row. A user could then re-subscribe
-- with the same email and receive a fresh welcome coupon. By keeping the row and
-- setting unsubscribed_at instead, the coupon history is preserved and re-subscribes
-- only reactivate the list membership without issuing a new coupon.

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_email_subscribers_unsubscribed_at
  ON public.email_subscribers (unsubscribed_at)
  WHERE unsubscribed_at IS NOT NULL;
