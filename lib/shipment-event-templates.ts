import type { FulfillmentType } from "@/lib/shipment-status";

/**
 * Canonical shipment_events templates, keyed by fulfillment_type. Shared by
 * every place that creates a shipment's initial timeline (the standalone
 * "add shipment" admin endpoint, and manual order creation) so the two can't
 * drift out of sync with each other or with eventKeyToOrderStatus's event_key
 * expectations in lib/shipment-status.ts.
 *
 * available_now (Ship Now): the piece is already in our own stock, so the
 * timeline skips vendor/QC/certification legs — just 4 steps.
 * sourced_for_you: the piece is coming from an overseas sourcing partner, so
 * it also passes through quality inspection, certification, and an inbound
 * leg before packing/shipping — 7 steps.
 */
export type ShipmentEventTemplateRow = {
  event_key: string;
  label: string;
  description: string;
  sort_order: number;
  is_current: boolean;
  is_completed: boolean;
};

export const EVENTS_AVAILABLE_NOW: ShipmentEventTemplateRow[] = [
  { event_key: "confirmed",  label: "Order Confirmed", description: "Order placed and payment received.",       sort_order: 0, is_current: true,  is_completed: false },
  { event_key: "packing",    label: "Packing",         description: "Your piece is being carefully packaged.",   sort_order: 1, is_current: false, is_completed: false },
  { event_key: "shipped",    label: "Shipped",         description: "Your order is on its way to you.",          sort_order: 2, is_current: false, is_completed: false },
  { event_key: "delivered",  label: "Delivered",       description: "Your piece has arrived.",                   sort_order: 3, is_current: false, is_completed: false },
];

export const EVENTS_SOURCED: ShipmentEventTemplateRow[] = [
  { event_key: "confirmed",          label: "Order Confirmed",        description: "Order placed and payment received.",                                          sort_order: 0, is_current: true,  is_completed: false },
  { event_key: "quality_inspection", label: "Quality Inspection",     description: "Your piece is being carefully inspected to meet our standards.",              sort_order: 1, is_current: false, is_completed: false },
  { event_key: "certification",      label: "Certification",          description: "Your jade is undergoing authentication and certification.",                   sort_order: 2, is_current: false, is_completed: false },
  { event_key: "arriving_at_studio", label: "Arriving at Our Studio", description: "Your piece is on its way to our studio for final handling.",                  sort_order: 3, is_current: false, is_completed: false },
  { event_key: "packing",            label: "Packing",                description: "Your piece is undergoing final quality control and being packaged for shipment.", sort_order: 4, is_current: false, is_completed: false },
  { event_key: "shipped",            label: "Shipped",                description: "Your order has been carefully packaged and shipped.",                         sort_order: 5, is_current: false, is_completed: false },
  { event_key: "delivered",          label: "Delivered",              description: "Your piece has arrived. We hope it brings you lasting beauty.",               sort_order: 6, is_current: false, is_completed: false },
];

export function eventTemplateFor(fulfillmentType: FulfillmentType): ShipmentEventTemplateRow[] {
  return fulfillmentType === "available_now" ? EVENTS_AVAILABLE_NOW : EVENTS_SOURCED;
}
