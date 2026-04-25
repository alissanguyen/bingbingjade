-- migration_058: Accounting settings
-- Single-row config table for default supplies cost per order and estimate method.
-- Admin can update via the Recalculate panel. Seeded with defaults on creation.

CREATE TABLE accounting_settings (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  default_supplies_cost_per_order numeric(10,2) NOT NULL DEFAULT 20,
  supplies_estimate_method        text        NOT NULL DEFAULT 'per_order'
                                    CHECK (supplies_estimate_method IN ('per_order')),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Seed one row with defaults (app always reads/updates this single row)
INSERT INTO accounting_settings (id) VALUES (gen_random_uuid());

ALTER TABLE accounting_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON accounting_settings USING (false) WITH CHECK (false);
