-- Migration 008: Add size_detailed column for multi-dimension measurements
alter table public.products
  add column if not exists size_detailed numeric(8,2)[] default null;
