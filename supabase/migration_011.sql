-- Migration 011: Private storage buckets for product media
-- New private buckets alongside the existing public ones.
-- Existing products keep their public URLs; new products use private paths + signed URLs.

insert into storage.buckets (id, name, public)
values
  ('jade-images', 'jade-images', false),
  ('jade-videos', 'jade-videos', false)
on conflict (id) do nothing;

-- No public read policy — access is via signed URLs only (generated server-side).
-- The service role key (supabaseAdmin) bypasses RLS and can generate signed URLs freely.
-- No anon insert policy either — uploads go through the /api/upload-image route (server-side).
