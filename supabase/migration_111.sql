-- Migration 111: Generic audit log
--
-- No audit-log table exists anywhere in the codebase today. This one is
-- intentionally generic (actor/action/entity/before/after/metadata) so it
-- can be reused beyond the employee-portal feature, but for now it's only
-- written to by employee-portal role/status changes, submission/review
-- transitions, credit revocation, and payout transitions.

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id  TEXT        NOT NULL,
  action         TEXT        NOT NULL,
  entity_type    TEXT        NOT NULL,
  entity_id      TEXT        NOT NULL,
  previous_value JSONB,
  new_value      JSONB,
  metadata       JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON audit_logs USING (false) WITH CHECK (false);
