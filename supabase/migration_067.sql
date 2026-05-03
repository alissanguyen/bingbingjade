-- migration_067: Add unsubscribe_token to email_subscribers for per-recipient unsubscribe links

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill any existing rows that got the column default (should already be set by DEFAULT)
UPDATE public.email_subscribers
  SET unsubscribe_token = gen_random_uuid()
  WHERE unsubscribe_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_unsubscribe_token
  ON public.email_subscribers (unsubscribe_token);
