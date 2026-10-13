import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { InventoryBatchesClient } from "./InventoryBatchesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory Batches — Admin" };

export default async function InventoryBatchesPage() {
  const [{ data }, { data: batchItems }] = await Promise.all([
    supabaseAdmin
      .from("inventory_batches")
      .select("id, name, batch_code, vendor, status, purchase_date, received_date, total_batch_cost_usd, item_count, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("inventory_batch_items").select("batch_id, product_id"),
  ]);

  // Per-batch linked/sold counts — same rules as the batch detail page
  const productIds = [
    ...new Set((batchItems ?? []).map((i) => i.product_id).filter((id): id is string => !!id)),
  ];
  let soldProductIds = new Set<string>();
  if (productIds.length > 0) {
    const { data: productData } = await supabaseAdmin
      .from("products")
      .select("id, status")
      .in("id", productIds);
    soldProductIds = new Set((productData ?? []).filter((p) => p.status === "sold").map((p) => p.id));
  }

  const stats = new Map<string, { linked_item_count: number; linked_product_count: number; sold_count: number }>();
  for (const item of batchItems ?? []) {
    const s = stats.get(item.batch_id) ?? { linked_item_count: 0, linked_product_count: 0, sold_count: 0 };
    s.linked_item_count++;
    if (item.product_id) {
      s.linked_product_count++;
      if (soldProductIds.has(item.product_id)) s.sold_count++;
    }
    stats.set(item.batch_id, s);
  }

  const batches = (data ?? []).map((b) => ({
    ...b,
    ...(stats.get(b.id) ?? { linked_item_count: 0, linked_product_count: 0, sold_count: 0 }),
  }));

  return (
    <>
      <AdminBarServer />
      <InventoryBatchesClient initialBatches={batches} />
    </>
  );
}
