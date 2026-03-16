-- Migration 007: Add pendant and necklace to category check constraint
alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('bracelet', 'bangle', 'ring', 'pendant', 'necklace', 'other'));
