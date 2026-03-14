-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Vendors table
create table public.vendors (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  platform  text not null check (platform in ('zalo', 'facebook', 'wechat', 'tiktok', 'other')),
  contact   text,
  notes     text
);

alter table public.vendors enable row level security;

-- Products table
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category            text not null check (category in ('bracelet', 'bangle', 'ring', 'other')),

  images              text[] not null default '{}',
  videos              text[] not null default '{}',

  color               text[] not null default '{}',
  tier                text not null,
  size                numeric not null,

  description         text,
  blemishes           text,

  price_display_usd   numeric(10, 2),
  imported_price_vnd  integer not null,

  vendor_id           uuid not null references public.vendors(id),
  created_at          timestamptz not null default now(),
  is_featured         boolean not null default false
);

create index products_category_idx on public.products (category);
create index products_featured_idx on public.products (is_featured);

alter table public.products enable row level security;

create policy "Public can view products"
  on public.products
  for select
  using (true);
