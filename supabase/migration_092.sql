-- Migration 092: Backfill missing shipments + events for manual (Zelle/cash/admin) orders
--
-- Paste this into the Supabase SQL editor. Change the order number on line 12
-- to target a specific order, or set to NULL to fix ALL manual orders.
-- Safe to run multiple times — skips shipments that already have events.
--
-- Also:
--  • Backfills event_time on 'confirmed' events that are missing it (sets to order.created_at)
--  • Fixes the advance-time bug: clears event_time from wrongly-stamped completed events
--    on orders that were advanced before this fix, so you can re-set them manually.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ← Set to the order number you want to fix (e.g. 'BBJ-1270').
  --   Set to NULL to fix ALL manual orders missing shipment events.
  v_target_order  text := 'BBJ-1270';

  v_order         RECORD;
  v_shipment_id   uuid;
  v_inv_type      text;
  v_event_count   int;
  v_ship_idx      int;
BEGIN

  FOR v_order IN
    SELECT o.id, o.order_number
    FROM public.orders o
    WHERE (v_target_order IS NULL OR o.order_number = v_target_order)
      -- Only manual / non-Stripe orders
      AND o.source IN ('zelle', 'cash', 'paypal', 'admin', 'custom')
  LOOP

    -- ── Step 1: create a shipment if none exists for this order ──────────────
    IF NOT EXISTS (
      SELECT 1 FROM public.shipments WHERE order_id = v_order.id
    ) THEN
      v_ship_idx := 1;

      FOR v_inv_type IN
        SELECT DISTINCT COALESCE(oi.inventory_type, 'sourced_for_you')
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
      LOOP
        INSERT INTO public.shipments
          (order_id, shipment_number, fulfillment_type, status)
        VALUES
          (v_order.id,
           COALESCE(v_order.order_number, 'MANUAL') || '-S' || v_ship_idx,
           v_inv_type,
           'confirmed')
        RETURNING id INTO v_shipment_id;

        -- Link all items of this type to the new shipment
        INSERT INTO public.shipment_items (shipment_id, order_item_id)
        SELECT v_shipment_id, oi.id
        FROM   public.order_items oi
        WHERE  oi.order_id = v_order.id
          AND  COALESCE(oi.inventory_type, 'sourced_for_you') = v_inv_type
        ON CONFLICT (order_item_id) DO NOTHING;

        v_ship_idx := v_ship_idx + 1;

        RAISE NOTICE 'Created shipment % (%) for order %',
          v_shipment_id, v_inv_type, v_order.order_number;
      END LOOP;
    END IF;

    -- ── Step 2: for each shipment with no events, insert the right set ───────
    FOR v_shipment_id, v_inv_type IN
      SELECT s.id, COALESCE(s.fulfillment_type, 'sourced_for_you')
      FROM public.shipments s
      WHERE s.order_id = v_order.id
    LOOP
      SELECT COUNT(*) INTO v_event_count
      FROM public.shipment_events
      WHERE shipment_id = v_shipment_id;

      IF v_event_count > 0 THEN
        RAISE NOTICE 'Shipment % already has % event(s) — skipping.', v_shipment_id, v_event_count;
        CONTINUE;
      END IF;

      IF v_inv_type = 'available_now' THEN
        INSERT INTO public.shipment_events
          (shipment_id, event_key, label, description, sort_order, is_current, is_completed)
        VALUES
          (v_shipment_id, 'confirmed', 'Order Confirmed', 'Order placed and payment received.',      0, true,  false),
          (v_shipment_id, 'packing',   'Packing',         'Your piece is being carefully packaged.', 1, false, false),
          (v_shipment_id, 'shipped',   'Shipped',         'Your order is on its way to you.',         2, false, false),
          (v_shipment_id, 'delivered', 'Delivered',       'Your piece has arrived.',                 3, false, false);
      ELSE
        -- sourced_for_you (default for Zelle / manual orders)
        INSERT INTO public.shipment_events
          (shipment_id, event_key, label, description, sort_order, is_current, is_completed)
        VALUES
          (v_shipment_id, 'confirmed',          'Order Confirmed',        'Order placed and payment received.',                             0, true,  false),
          (v_shipment_id, 'quality_inspection', 'Quality Inspection',     'Your piece is being carefully inspected to meet our standards.', 1, false, false),
          (v_shipment_id, 'certification',      'Certification',          'Your jade is undergoing authentication and certification.',      2, false, false),
          (v_shipment_id, 'arriving_at_studio', 'Arriving at Our Studio', 'Your piece is on its way to our studio for final handling.',    3, false, false),
          (v_shipment_id, 'shipped',            'Shipped',                'Your order has been carefully packaged and shipped.',            4, false, false),
          (v_shipment_id, 'delivered',          'Delivered',              'Your piece has arrived. We hope it brings you lasting beauty.',  5, false, false);
      END IF;

      RAISE NOTICE 'Inserted % events for shipment % (order %).',
        v_inv_type, v_shipment_id, v_order.order_number;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Done backfilling shipments/events.';
END $$;

-- ── Fix 1: Stamp event_time on confirmed events that are missing it ───────────
-- Sets event_time = order.created_at for any 'confirmed' shipment event where
-- event_time is currently NULL.
UPDATE public.shipment_events se
SET    event_time = o.created_at
FROM   public.shipments s
JOIN   public.orders    o ON o.id = s.order_id
WHERE  se.shipment_id = s.id
  AND  se.event_key   = 'confirmed'
  AND  se.event_time  IS NULL;

-- ── Fix 2: Clear wrongly-stamped event_time from completed non-confirmed events
-- Before this fix, Advance was stamping event_time on the step being completed
-- rather than the step becoming current.  For any completed event whose time
-- equals its *next* event's time (meaning it was stamped by the same Advance
-- click), clear it so the admin can set the correct date manually.
-- (This is a best-effort heuristic — review dates in the UI after running.)
UPDATE public.shipment_events se
SET    event_time = NULL
FROM   public.shipment_events se_next
WHERE  se_next.shipment_id = se.shipment_id
  AND  se_next.sort_order  = se.sort_order + 1
  AND  se.is_completed     = true
  AND  se.event_key       <> 'confirmed'
  AND  se.event_time      IS NOT NULL
  AND  se_next.event_time IS NOT NULL
  AND  se.event_time      = se_next.event_time;
