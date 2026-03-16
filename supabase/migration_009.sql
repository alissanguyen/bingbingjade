-- Migration 009: Convert tier from text to text[] to support multiple tier selections
alter table public.products
  alter column tier type text[]
  using case when tier is null or tier = '' then null else array[tier] end;
