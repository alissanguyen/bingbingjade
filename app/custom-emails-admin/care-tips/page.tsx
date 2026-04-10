import { supabaseAdmin } from "@/lib/supabase-admin";
import { CareTipsClient, type DeliveredOrder } from "./CareTipsClient";

export default async function CareTipsPage() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, delivered_at, created_at")
    .eq("order_status", "delivered")
    .not("customer_email", "is", null)
    .gte("updated_at", since)
    .order("delivered_at", { ascending: false, nullsFirst: false });

  return <CareTipsClient orders={(data ?? []) as DeliveredOrder[]} />;
}
