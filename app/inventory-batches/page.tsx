import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { InventoryBatchesClient } from "./InventoryBatchesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory Batches — Admin" };

export default async function InventoryBatchesPage() {
  const { data } = await supabaseAdmin
    .from("inventory_batches")
    .select("id, name, batch_code, vendor, status, purchase_date, received_date, total_batch_cost_usd, item_count, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminBarServer />
      <InventoryBatchesClient initialBatches={data ?? []} />
    </>
  );
}
