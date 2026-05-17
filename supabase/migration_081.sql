-- Add hero focal point and crop settings to collections.
-- crop_* columns are reserved for future server-side crop support; not written by the UI yet.
-- focal_* columns drive CSS object-position on the hero banner.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS hero_crop_x          FLOAT,
  ADD COLUMN IF NOT EXISTS hero_crop_y          FLOAT,
  ADD COLUMN IF NOT EXISTS hero_crop_width      FLOAT,
  ADD COLUMN IF NOT EXISTS hero_crop_height     FLOAT,
  ADD COLUMN IF NOT EXISTS hero_focal_x         FLOAT,
  ADD COLUMN IF NOT EXISTS hero_focal_y         FLOAT,
  ADD COLUMN IF NOT EXISTS hero_mobile_focal_x  FLOAT,
  ADD COLUMN IF NOT EXISTS hero_mobile_focal_y  FLOAT;
