import { supabaseAdmin } from "@/lib/supabase-admin";
import { OrderDelaysClient, type DelayOrder } from "./OrderDelaysClient";

const NON_DELIVERED_STATUSES = [
  "order_created", "order_confirmed", "in_production",
  "polishing", "quality_control", "certifying",
  "inbound_shipping", "outbound_shipping",
];

export default async function OrderDelaysPage() {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, order_status, created_at")
    .in("order_status", NON_DELIVERED_STATUSES)
    .order("created_at", { ascending: false });

  return <OrderDelaysClient orders={(data ?? []) as DelayOrder[]} />;
}
