-- migration_021: reviews table
create table public.reviews (
  id             uuid        primary key default gen_random_uuid(),
  order_id       uuid        not null references public.orders(id) on delete cascade,
  order_number   text        not null,
  customer_id    uuid        references public.customers(id) on delete set null,
  customer_name  text        not null,
  rating         smallint    not null check (rating between 1 and 10),
  description    text,
  date_purchased timestamptz not null,
  date_rated     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- one review per order
create unique index reviews_order_id_key on public.reviews (order_id);

alter table public.reviews enable row level security;

-- anyone can submit and read (no customer login required)
create policy "Anyone can insert a review"
  on public.reviews for insert with check (true);

create policy "Anyone can read reviews"
  on public.reviews for select using (true);
