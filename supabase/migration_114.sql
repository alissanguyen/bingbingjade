-- Migration 114: Per-user session revocation for approved_users
--
-- approved_session cookies are stateless (signed userId, no server-side
-- session table), so there was previously no way to invalidate one
-- specific user's already-issued cookie without changing the global HMAC
-- secret (which would sign every approved user out at once). session_version
-- fixes that cheaply: it's embedded in the signed cookie, and getSessionUser()
-- rejects any cookie whose embedded version doesn't match the current DB
-- value. "Revoke all active sessions" for one employee is then just
-- incrementing this column.

ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;
