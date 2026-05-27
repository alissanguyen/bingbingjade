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
      .select("id, product_id, assigned_inventory_cost_usd, allocation_method, notes, created_at, products(id, name, public_id, images)")
      .eq("batch_id", id)
      .order("created_at"),
  ]);

  if (!batch) notFound();

  // Resolve product thumbnails + public_id
  type RawItem = typeof items extends (infer T)[] | null ? T : never;
  const resolvedItems = await Promise.all(
    (items ?? []).map(async (item: RawItem) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = Array.isArray((item as any).products) ? (item as any).products[0] : (item as any).products;
      const imageUrl = product?.images ? await resolveFirstImageUrl(product.images as string[]) : null;
      return {
        ...item,
        productName: product?.name ?? null,
        productPublicId: product?.public_id ?? null,
        productImageUrl: imageUrl,
      };
    })
  );

  // Revenue: sum order_items.price_usd for non-cancelled orders containing batch products
  const productIds = resolvedItems.map((i) => i.product_id).filter((id): id is string => !!id);

  let revenue = 0;
  let soldCount = 0;

  if (productIds.length > 0) {
    // Fetch order items for these products
    const [{ data: orderItemsData }, { data: productStatusData }] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select("product_id, price_usd, quantity, order_id")
        .in("product_id", productIds),
      supabaseAdmin
        .from("products")
        .select("id, status")
        .in("id", productIds),
    ]);

    // Filter to non-cancelled orders
    const orderIds = [...new Set((orderItemsData ?? []).map((i) => i.order_id).filter(Boolean))];
    if (orderIds.length > 0) {
      const { data: ordersData } = await supabaseAdmin
        .from("orders")
        .select("id")
        .in("id", orderIds)
        .neq("order_status", "order_cancelled");

      const validOrderIds = new Set((ordersData ?? []).map((o) => o.id));
      revenue = (orderItemsData ?? [])
        .filter((i) => i.order_id && validOrderIds.has(i.order_id))
        .reduce((sum, i) => sum + (Number(i.price_usd) ?? 0) * (Number(i.quantity) ?? 1), 0);
    }

    soldCount = (productStatusData ?? []).filter((p) => p.status === "sold").length;
  }

  return (
    <>
      <AdminBarServer />
      <InventoryBatchDetailClient
        batch={batch}
        items={resolvedItems}
        revenue={revenue}
        soldCount={soldCount}
        totalCount={productIds.length}
      />
    </>
  );
}
