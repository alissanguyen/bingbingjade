import { notFound } from "next/navigation";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { OrderDetailClient } from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabaseAdmin.from("orders").select("order_number").eq("id", id).single();
  return { title: data?.order_number ? `${data.order_number} — Admin` : "Order — Admin" };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items(*),
      shipping_address:customer_addresses(
        recipient_name, address_line1, address_line2,
        city, state_or_region, postal_code, country
      ),
      shipments(
        *,
        shipment_events(*),
        shipment_items(id, order_item_id)
      )
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  // Fetch product images for each order item that has a product_id
  const productIds = (order.order_items as { product_id: string | null }[])
    .map((i) => i.product_id)
    .filter((id): id is string => !!id);

  let productImages: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, images")
      .in("id", productIds);

    // resolveFirstImageUrl converts storage paths (wm/file.jpg) → full public URLs
    const resolved = await Promise.all(
      (products ?? []).map(async (p) => {
        const url = await resolveFirstImageUrl(p.images as string[]);
        return [p.id, url ?? ""] as [string, string];
      })
    );
    productImages = Object.fromEntries(resolved);
  }

  return (
    <>
      <AdminBarServer />
      <OrderDetailClient order={order} productImages={productImages} />
    </>
  );
}
