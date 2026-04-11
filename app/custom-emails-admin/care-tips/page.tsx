import { supabaseAdmin } from "@/lib/supabase-admin";
import { CareTipsClient, type DeliveredOrder } from "./CareTipsClient";

export default async function CareTipsPage() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, created_at")
    .eq("order_status", "delivered")
    .not("customer_email", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  return <CareTipsClient orders={(data ?? []) as DeliveredOrder[]} />;
}
