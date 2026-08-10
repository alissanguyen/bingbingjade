-- migration_120: BingBing Gallery — public masonry gallery of brand images,
-- each with the BingBing logo baked in at an admin-chosen position.

insert into storage.buckets (id, name, public)
values ('bingbing-gallery', 'bingbing-gallery', true)
on conflict (id) do nothing;

create table if not exists public.bingbing_gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,        -- final watermark-baked image path in the bingbing-gallery bucket
  logo_x float not null check (logo_x between 0 and 100),
  logo_y float not null check (logo_y between 0 and 100),
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists bingbing_gallery_images_published_idx
  on public.bingbing_gallery_images (published, sort_order);
