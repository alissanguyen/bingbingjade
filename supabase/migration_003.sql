-- ============================================================
-- Migration 003: Change color from text to text array
-- ============================================================

alter table public.products
  alter column color type text[] using array[color]::text[];

alter table public.products
  alter column color set default '{}';
