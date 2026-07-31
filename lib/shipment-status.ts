/**
 * Maps a shipment_events.event_key (per-shipment fulfillment timeline) to
 * the coarser-grained shipments.status / orders.order_status fields.
 *
 * Shared by advance-event and revert-event so the two can't drift out of
 * sync with each other or with the event_key lists in
 * app/api/admin/orders/[id]/shipments/route.ts (EVENTS_AVAILABLE_NOW /
 * EVENTS_SOURCED) the way they previously did — "arriving_at_studio" and
 * "packing" were both silently unmapped, leaving order_status stuck on a
 * stale value as a shipment progressed through those stages.
 */

export function eventKeyToShipmentStatus(key: string): string {
  if (key === "shipped") return "shipped";
  if (key === "delivered") return "delivered";
  if (key === "confirmed") return "confirmed";
  return "processing";
}

/**
 * order_status has no dedicated "packing" value, so packing and
 * "arriving at our studio" both map to inbound_shipping — the piece is
 * still with us either way, just further along the same coarse stage.
 */
export function eventKeyToOrderStatus(key: string): string | null {
  if (key === "delivered") return "delivered";
  if (key === "shipped") return "outbound_shipping";
  if (key === "packing" || key === "arriving_at_studio" || key === "inbound" || key === "inbound_shipping" || key === "arriving") return "inbound_shipping";
  if (key === "certifying" || key === "certification") return "certifying";
  if (key === "quality_inspection" || key === "quality_control") return "quality_control";
  if (key === "polishing" || key === "finishing") return "polishing";
  if (key === "in_production" || key === "production") return "in_production";
  if (key === "confirmed") return "order_confirmed";
  return null;
}
