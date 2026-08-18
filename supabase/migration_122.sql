-- migration_122: Let admin set a custom subject line for a store-credit email.
--
-- Set once at issuance (mirrors customer_message), reused automatically on
-- resend via buildStoreCreditEmailHtml(). NULL/blank falls back to the
-- auto-generated "... — {Reason}" subject.

ALTER TABLE public.store_credits
  ADD COLUMN IF NOT EXISTS custom_subject text;
