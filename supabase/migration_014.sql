-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text      UNIQUE NOT NULL,
  customer_email  text,
  customer_name   text,
  amount_total    integer,    -- in cents
  currency        text        NOT NULL DEFAULT 'usd',
  status          text        NOT NULL DEFAULT 'paid',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Order items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id          uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  product_option_id   uuid        REFERENCES public.product_options(id) ON DELETE SET NULL,
  product_name        text        NOT NULL,
  option_label        text,
  price_usd           numeric(10,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);
