-- Migration 042: Shipment-based fulfillment model
-- Renames fulfillment_type → inventory_type on order_items,
-- adds shipments / shipment_items / shipment_events tables,
-- then backfills one shipment per (order, inventory_type) group.

-- ── 1. Rename column ──────────────────────────────────────────────────────────
ALTER TABLE public.order_items
  RENAME COLUMN fulfillment_type TO inventory_type;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_fulfillment_type_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_inventory_type_check
  CHECK (inventory_type IN ('available_now', 'sourced_for_you'));

-- ── 2. shipments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipments (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                 uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shipment_number          text,
  fulfillment_type         text        CHECK (fulfillment_type IN ('available_now', 'sourced_for_you')),
  status                   text        NOT NULL DEFAULT 'confirmed',
  carrier                  text,
  tracking_number          text,
  tracking_url             text,
  shipping_method          text,
  shipping_cost            numeric(10,2),
  insurance_selected       boolean     DEFAULT false,
  destination_country      text,
  estimated_ship_date      date,
  estimated_delivery_start date,
  estimated_delivery_end   date,
  shipped_at               timestamptz,
  delivered_at             timestamptz,
  created_at               timestamptz DEFAULT now() NOT NULL,
  updated_at               timestamptz DEFAULT now() NOT NULL
);

-- ── 3. shipment_items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipment_items (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id    uuid        NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  order_item_id  uuid        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (order_item_id)          -- each order_item belongs to exactly one shipment
);

-- ── 4. shipment_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id  uuid        NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_key    text        NOT NULL,
  label        text        NOT NULL,
  description  text,
  event_time   timestamptz,
  is_current   boolean     DEFAULT false,
  is_completed boolean     DEFAULT false,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now() NOT NULL
);

-- ── 5. Backfill existing orders ───────────────────────────────────────────────
-- One shipment per distinct (order_id, inventory_type) pair.
-- Skips orders that already have shipments (idempotent).
DO $$
DECLARE
  r          RECORD;
  s_id       uuid;
  s_count    int  := 0;
  last_order uuid := NULL;
BEGIN
  FOR r IN
    SELECT DISTINCT
      oi.order_id,
      COALESCE(oi.inventory_type, 'sourced_for_you') AS inv_type,
      o.order_number
    FROM public.order_items oi
    JOIN public.orders      o  ON o.id = oi.order_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.shipments sh WHERE sh.order_id = oi.order_id
    )
    ORDER BY oi.order_id, COALESCE(oi.inventory_type, 'sourced_for_you')
  LOOP
    IF r.order_id IS DISTINCT FROM last_order THEN
      s_count    := 0;
      last_order := r.order_id;
    END IF;
    s_count := s_count + 1;

    INSERT INTO public.shipments (order_id, shipment_number, fulfillment_type, status)
    VALUES (
      r.order_id,
      COALESCE(r.order_number, 'LEGACY') || '-S' || s_count,
      r.inv_type,
      'confirmed'
    )
    RETURNING id INTO s_id;

    INSERT INTO public.shipment_items (shipment_id, order_item_id)
    SELECT s_id, oi.id
    FROM   public.order_items oi
    WHERE  oi.order_id = r.order_id
      AND  COALESCE(oi.inventory_type, 'sourced_for_you') = r.inv_type
    ON CONFLICT (order_item_id) DO NOTHING;

    IF r.inv_type = 'available_now' THEN
      INSERT INTO public.shipment_events
        (shipment_id, event_key, label, description, sort_order, is_current, is_completed)
      VALUES
        (s_id, 'confirmed', 'Order Confirmed', 'Order placed and payment received.',        0, true,  false),
        (s_id, 'packing',   'Packing',         'Your piece is being carefully packaged.',   1, false, false),
        (s_id, 'shipped',   'Shipped',          'Your order is on its way to you.',          2, false, false),
        (s_id, 'delivered', 'Delivered',        'Your piece has arrived.',                  3, false, false);
    ELSE
      INSERT INTO public.shipment_events
        (shipment_id, event_key, label, description, sort_order, is_current, is_completed)
      VALUES
        (s_id, 'confirmed',          'Order Confirmed',        'Order placed and payment received.',                             0, true,  false),
        (s_id, 'quality_inspection', 'Quality Inspection',     'Your piece is being carefully inspected to meet our standards.', 1, false, false),
        (s_id, 'certification',      'Certification',          'Your jade is undergoing authentication and certification.',      2, false, false),
        (s_id, 'arriving_at_studio', 'Arriving at Our Studio', 'Your piece is on its way to our studio for final handling.',    3, false, false),
        (s_id, 'shipped',            'Shipped',                'Your order has been carefully packaged and shipped.',            4, false, false),
        (s_id, 'delivered',          'Delivered',              'Your piece has arrived. We hope it brings you lasting beauty.',  5, false, false);
    END IF;
  END LOOP;
END $$;
