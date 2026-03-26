export type OrderStatus =
  | "order_created"
  | "order_confirmed"
  | "in_production"
  | "polishing"
  | "quality_control"
  | "certifying"
  | "inbound_shipping"
  | "outbound_shipping"
  | "delivered"
  | "order_cancelled";

export type OrderSource = "stripe" | "whatsapp" | "cash" | "paypal" | "wire" | "custom" | "admin";

export type PaidStatus = "paid" | "unpaid" | "refunded";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_option_id: string | null;
  product_name: string;
  option_label: string | null;
  price_usd: number | null;
  quantity: number;
  line_total: number | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_snapshot: string | null;
  amount_total: number | null; // cents
  currency: string;
  status: string;           // paid | unpaid | refunded
  order_status: OrderStatus;
  source: OrderSource;
  order_type: "standard" | "custom";
  estimated_delivery_date: string | null;
  shipping_address_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  stripe_customer_id: string | null;
  number_of_orders: number;
  is_frequent_customer: boolean;
  created_at: string;
  updated_at: string;
}
