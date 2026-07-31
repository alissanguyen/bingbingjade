-- Migration 118: Add "Packing" stage to the Sourced for You shipment pipeline
--
-- The Sourced for You tracker jumped straight from "Arriving at Our Studio"
-- to "Shipped" with no step for the studio actually packing the piece.
-- New shipments already get this via the updated EVENTS_SOURCED templates
-- in lib/orders.ts and app/api/admin/orders/[id]/shipments/route.ts; this
-- migration backfills existing in-flight "sourced_for_you" shipments so
-- their trackers match.
--
-- Safe to run multiple times — skips shipments that already have a
-- 'packing' event.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_shipment_id     uuid;
  v_already_passed  boolean;
BEGIN
  FOR v_shipment_id IN
    SELECT s.id
    FROM public.shipments s
    WHERE s.fulfillment_type = 'sourced_for_you'
      AND NOT EXISTS (
        SELECT 1 FROM public.shipment_events se
        WHERE se.shipment_id = s.id AND se.event_key = 'packing'
      )
      -- only shipments that actually have the standard sourced_for_you pipeline
      AND EXISTS (
        SELECT 1 FROM public.shipment_events se
        WHERE se.shipment_id = s.id AND se.event_key = 'arriving_at_studio'
      )
  LOOP
    -- Make room: shift 'shipped' and 'delivered' one slot later.
    UPDATE public.shipment_events
    SET    sort_order = sort_order + 1
    WHERE  shipment_id = v_shipment_id
      AND  event_key IN ('shipped', 'delivered');

    -- Has this shipment already reached/passed 'shipped'? If so the new
    -- 'packing' stage happened in the past — mark it completed rather than
    -- inserting an incomplete step "below" a completed one.
    SELECT EXISTS (
      SELECT 1 FROM public.shipment_events se
      WHERE se.shipment_id = v_shipment_id
        AND se.event_key IN ('shipped', 'delivered')
        AND (se.is_completed OR se.is_current)
    ) INTO v_already_passed;

    INSERT INTO public.shipment_events
      (shipment_id, event_key, label, description, sort_order, is_current, is_completed)
    VALUES (
      v_shipment_id,
      'packing',
      'Packing',
      'Your piece is undergoing final quality control and being packaged for shipment.',
      4,
      false,
      v_already_passed
    );

    RAISE NOTICE 'Inserted packing event for shipment % (completed=%)', v_shipment_id, v_already_passed;
  END LOOP;

  RAISE NOTICE 'Done backfilling packing stage.';
END $$;
