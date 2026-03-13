-- ============================================================
-- Migration 002: Storage buckets for product media
-- ============================================================

-- Create buckets
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('product-videos', 'product-videos', true)
on conflict (id) do nothing;

-- Public read for images
create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow uploads to product-images
create policy "Allow upload to product-images"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

-- Public read for videos
create policy "Public read product-videos"
  on storage.objects for select
  using (bucket_id = 'product-videos');

-- Allow uploads to product-videos
create policy "Allow upload to product-videos"
  on storage.objects for insert
  with check (bucket_id = 'product-videos');
