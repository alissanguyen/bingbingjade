-- migration_035: Subscriber welcome coupon codes + abuse fingerprint

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS welcome_coupon_code         CHAR(6),
  ADD COLUMN IF NOT EXISTS welcome_coupon_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_fingerprint            TEXT;  -- "phone|city|postal|country" stored after redemption

-- Unique index on coupon code (only when assigned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_coupon_code
  ON public.email_subscribers (welcome_coupon_code)
  WHERE welcome_coupon_code IS NOT NULL;

-- Index for fingerprint abuse checks
CREATE INDEX IF NOT EXISTS idx_email_subscribers_fingerprint
  ON public.email_subscribers (used_fingerprint)
  WHERE used_fingerprint IS NOT NULL;

-- Also add created_by to coupon_campaigns for tracking who made it
ALTER TABLE public.coupon_campaigns
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS notes      TEXT;
