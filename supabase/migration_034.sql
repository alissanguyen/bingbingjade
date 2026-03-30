-- migration_034: Generation token system for approved users

-- Add token balance to approved users (default 10)
ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS generation_tokens INT NOT NULL DEFAULT 10;

-- Token request log
CREATE TABLE IF NOT EXISTS token_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES approved_users(id) ON DELETE CASCADE,
  message          TEXT,
  requested_amount INT         NOT NULL DEFAULT 10,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'denied')),
  granted_amount   INT,
  admin_note       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_token_requests_user_id  ON token_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_token_requests_status   ON token_requests (status) WHERE status = 'pending';
