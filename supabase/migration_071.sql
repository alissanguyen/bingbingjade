-- Extend site_banners for full banner system
ALTER TABLE site_banners
  RENAME COLUMN target_date TO start_date;

ALTER TABLE site_banners
  ADD COLUMN IF NOT EXISTS end_date   timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preset     text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cta_text   text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cta_link   text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS style      jsonb       DEFAULT NULL;
