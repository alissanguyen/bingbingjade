-- Add countdown_label column to site_banners
ALTER TABLE site_banners
  ADD COLUMN IF NOT EXISTS countdown_label TEXT
    CHECK (countdown_label IN ('Starting in', 'Ends in'));
