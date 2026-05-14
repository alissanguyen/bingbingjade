-- Add mobile position overrides to collection scene tags
ALTER TABLE public.collection_scene_tags
  ADD COLUMN IF NOT EXISTS mobile_x FLOAT CHECK (mobile_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS mobile_y FLOAT CHECK (mobile_y BETWEEN 0 AND 100);
