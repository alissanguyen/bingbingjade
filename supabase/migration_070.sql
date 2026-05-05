-- Add messages array to site_banners for rotating multi-message banners
ALTER TABLE site_banners
  ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb;
