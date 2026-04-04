export type FulfillmentType = "available_now" | "sourced_for_you";

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_key: string;
  label: string;
  description: string | null;
  event_time: string | null;
  is_current: boolean;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  order_item_id: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  shipment_number: string | null;
  fulfillment_type: FulfillmentType | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_method: string | null;
  shipping_cost: number | null;
  insurance_selected: boolean;
  destination_country: string | null;
  estimated_ship_date: string | null;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  shipment_events: ShipmentEvent[];
  shipment_items: (ShipmentItem & { order_items: { product_name: string; option_label: string | null } | null })[];
}
