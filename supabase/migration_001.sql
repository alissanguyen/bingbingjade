-- ============================================================
-- Migration 001: Update products table + create vendors table
-- ============================================================

-- 1. Add videos column
alter table public.products
  add column if not exists videos text[] not null default '{}';

-- 2. Add ring to category enum (drop and recreate the check constraint)
alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('bracelet', 'bangle', 'ring', 'other'));

-- 3. Make size required (not null) — set existing nulls to 0 first
update public.products set size = 0 where size is null;
alter table public.products alter column size set not null;

-- 4. Rename display_price_usd to price_display_usd
alter table public.products
  rename column display_price_usd to price_display_usd;

-- 5. Make price_display_usd optional
alter table public.products
  alter column price_display_usd drop not null;

-- 6. Make description and blemishes optional
alter table public.products
  alter column description drop not null;

alter table public.products
  alter column blemishes drop not null;

-- 7. Add is_featured column
alter table public.products
  add column if not exists is_featured boolean not null default false;

-- ============================================================
-- Vendors table
-- ============================================================

create table public.vendors (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  platform  text not null check (platform in ('zalo', 'facebook', 'wechat', 'tiktok', 'other')),
  contact   text,
  notes     text
);

-- Enable Row Level Security
alter table public.vendors enable row level security;
