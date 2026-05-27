import { notFound } from "next/navigation";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { InventoryBatchDetailClient } from "./InventoryBatchDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabaseAdmin.from("inventory_batches").select("name").eq("id", id).single();
  return { title: data?.name ? `${data.name} — Inventory` : "Batch — Admin" };
}

export default async function InventoryBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: batch }, { data: items }] = await Promise.all([
    supabaseAdmin.from("inventory_batches").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("inventory_batch_items")
      .select("id, product_id, assigned_inventory_cost_usd, allocation_method, notes, created_at, products(id, name, images)")
      .eq("batch_id", id)
      .order("created_at"),
  ]);

  if (!batch) notFound();

  // Resolve product thumbnails
  type RawItem = typeof items extends (infer T)[] | null ? T : never;
  const resolvedItems = await Promise.all(
    (items ?? []).map(async (item: RawItem) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = Array.isArray((item as any).products) ? (item as any).products[0] : (item as any).products;
      const imageUrl = product?.images ? await resolveFirstImageUrl(product.images as string[]) : null;
      return { ...item, productName: product?.name ?? null, productImageUrl: imageUrl };
    })
  );

  return (
    <>
      <AdminBarServer />
      <InventoryBatchDetailClient batch={batch} items={resolvedItems} />
    </>
  );
}
