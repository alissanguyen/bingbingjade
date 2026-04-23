-- Migration 053: Rewards magic-link tokens
-- Short-lived tokens for the no-login /rewards lookup page.
-- Tokens expire after 15 minutes. Valid within the window; no single-use marking needed
-- since the entropy (32 random bytes) and short TTL provide sufficient security.

CREATE TABLE IF NOT EXISTS public.rewards_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  token_hash text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_tokens_email      ON public.rewards_tokens (email);
CREATE INDEX IF NOT EXISTS idx_rewards_tokens_token_hash ON public.rewards_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_rewards_tokens_expires_at ON public.rewards_tokens (expires_at);

-- RLS: only service role may read/write this table
ALTER TABLE public.rewards_tokens ENABLE ROW LEVEL SECURITY;
