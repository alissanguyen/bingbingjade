-- Add hero_scene_id to collections so admins can select an existing scene as the banner background.
-- ON DELETE SET NULL means deleting the scene gracefully clears the hero reference.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS hero_scene_id uuid
    REFERENCES public.collection_scenes(id) ON DELETE SET NULL;
