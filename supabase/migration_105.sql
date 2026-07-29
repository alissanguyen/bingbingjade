-- Migration 105: Catalog Contributor role + employee profiles
--
-- Adds a `role` to the existing approved_users table so it can host a second,
-- much more restricted account type ("catalog_contributor") alongside the
-- existing trusted "partner" approved users, without duplicating the
-- password/session infrastructure in lib/approved-auth.ts.
--
-- `employee_profiles` is a 1:1 extension (bio, avatar, start date, pay rate)
-- kept separate from approved_users so the core auth table stays small and
-- so pay-rate history/edits are naturally scoped to one place.

ALTER TABLE approved_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'partner'
    CHECK (role IN ('partner', 'catalog_contributor'));

CREATE TABLE IF NOT EXISTS employee_profiles (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                           UUID        NOT NULL UNIQUE REFERENCES approved_users(id) ON DELETE CASCADE,
  display_name                      TEXT        NOT NULL,
  bio                                TEXT,
  avatar_url                        TEXT,
  start_date                        DATE        NOT NULL DEFAULT CURRENT_DATE,
  default_rate_per_approved_listing NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                            TEXT        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_user_id ON employee_profiles(user_id);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON employee_profiles USING (false) WITH CHECK (false);
