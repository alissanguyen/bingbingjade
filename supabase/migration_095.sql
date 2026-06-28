-- Migration 095: Livestream selling workflow
--
-- 1. Add 'reserved' to products status enum
-- 2. Add reservation fields to products
-- 3. Add 'livestream' to orders source enum
-- 4. Create livestreams, livestream_items, livestream_item_events, livestream_backup_buyers tables

-- 1. Products: add 'reserved' status
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('available', 'sold', 'on_sale', 'archived', 'reserved'));

-- 2. Products: reservation fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_until        timestamptz,
  ADD COLUMN IF NOT EXISTS reserved_for_handle   text,
  ADD COLUMN IF NOT EXISTS reserved_livestream_item_id uuid;

-- 3. Orders: add 'livestream' source
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check
  CHECK (source IN ('stripe','whatsapp','cash','paypal','wire','zelle','custom','admin','livestream'));

-- 4a. Livestreams table
CREATE TABLE IF NOT EXISTS public.livestreams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  platform      text NOT NULL DEFAULT 'instagram', -- instagram | tiktok | other
  scheduled_at  timestamptz,
  code_prefix   text NOT NULL DEFAULT 'A',         -- letter prefix for item codes (A1, A2…)
  item_count    int  NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'draft'       -- draft | live | ended
    CHECK (status IN ('draft','live','ended')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 4b. Livestream items table
CREATE TABLE IF NOT EXISTS public.livestream_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_id        uuid NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  code                 text NOT NULL,               -- e.g. "A1", "A12"
  display_order        int  NOT NULL DEFAULT 0,
  product_id           uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title_snapshot       text NOT NULL,               -- display name (may differ from product name)
  size                 text,
  price                numeric(10,2) NOT NULL,      -- asking price shown during live
  minimum_price        numeric(10,2),               -- floor; NULL = any price OK
  checkout_price       numeric(10,2),               -- actual charge (may differ after negotiation)
  price_override_note  text,                        -- reason if checkout_price ≠ price
  status               text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','checkout_sent','paid','passed','cancelled')),
  buyer_handle         text,                        -- IG/TT handle of winning bidder
  buyer_platform       text,                        -- instagram | tiktok | other
  checkout_url         text,                        -- Stripe private checkout URL
  checkout_token       uuid UNIQUE DEFAULT gen_random_uuid(), -- opaque token for /livestream-checkout/[token]
  checkout_session_id  text,                        -- Stripe checkout.session id
  checkout_expires_at  timestamptz,
  checkout_active      boolean NOT NULL DEFAULT false,
  order_id             uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  public_notes         text,                        -- visible on product page if needed
  private_notes        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestream_items_livestream_id ON public.livestream_items(livestream_id);
CREATE INDEX IF NOT EXISTS idx_livestream_items_product_id    ON public.livestream_items(product_id);
CREATE INDEX IF NOT EXISTS idx_livestream_items_checkout_token ON public.livestream_items(checkout_token);

-- 4c. Livestream item events log
CREATE TABLE IF NOT EXISTS public.livestream_item_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_item_id  uuid NOT NULL REFERENCES public.livestream_items(id) ON DELETE CASCADE,
  event_type          text NOT NULL,  -- claimed | checkout_sent | released | paid | passed | cancelled | note
  message             text,
  buyer_handle        text,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text         -- admin email or 'system'
);

CREATE INDEX IF NOT EXISTS idx_livestream_item_events_item_id ON public.livestream_item_events(livestream_item_id);

-- 4d. Backup buyers per item
CREATE TABLE IF NOT EXISTS public.livestream_backup_buyers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestream_item_id  uuid NOT NULL REFERENCES public.livestream_items(id) ON DELETE CASCADE,
  buyer_handle        text NOT NULL,
  buyer_platform      text,
  position            int  NOT NULL DEFAULT 1,  -- 1 = first backup, 2 = second, etc.
  status              text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','offered','declined','purchased')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_buyers_item_id ON public.livestream_backup_buyers(livestream_item_id);

-- RLS: all new tables are admin-only (service role bypasses RLS)
ALTER TABLE public.livestreams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestream_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestream_item_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestream_backup_buyers ENABLE ROW LEVEL SECURITY;

-- No public read policies — all access goes through API routes using supabaseAdmin
