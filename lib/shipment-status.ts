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

export type FulfillmentType = "available_now" | "sourced_for_you";

export function eventKeyToShipmentStatus(key: string): string {
  if (key === "shipped") return "shipped";
  if (key === "delivered") return "delivered";
  if (key === "confirmed") return "confirmed";
  return "processing";
}

/**
 * order_status is a single order-level field shared across every shipment
 * on the order, but the same event_key means different things depending on
 * fulfillment_type — "packing" on a Sourced for You shipment follows an
 * actual inbound-from-vendor leg (arriving_at_studio), so it's genuinely
 * "inbound_shipping". "packing" on a Ship Now shipment is the very next
 * step after order confirmation — the piece was never inbound from
 * anywhere, it's already in our own stock — so it must NOT claim
 * "Inbound Shipping". Ship Now only ever needs order_confirmed ->
 * outbound_shipping -> delivered; packing doesn't move order_status at all
 * for that fulfillment type (returns null — "no change").
 */
export function eventKeyToOrderStatus(key: string, fulfillmentType: FulfillmentType): string | null {
  if (key === "delivered") return "delivered";
  if (key === "shipped") return "outbound_shipping";
  if (key === "confirmed") return "order_confirmed";

  if (fulfillmentType === "sourced_for_you") {
    if (key === "packing" || key === "arriving_at_studio" || key === "inbound" || key === "inbound_shipping" || key === "arriving") return "inbound_shipping";
    if (key === "certifying" || key === "certification") return "certifying";
    if (key === "quality_inspection" || key === "quality_control") return "quality_control";
    if (key === "polishing" || key === "finishing") return "polishing";
    if (key === "in_production" || key === "production") return "in_production";
  }

  // available_now: "packing" (and anything else not covered above) has no
  // order_status equivalent — leave order_status wherever it already is.
  return null;
}
