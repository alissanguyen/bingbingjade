import { notFound } from "next/navigation";
import { AdminBar } from "@/app/components/AdminBar";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
      .select("id, images, slug, public_id")
      .in("id", productIds);

    productImages = Object.fromEntries(
      (products ?? []).map((p) => {
        const raw = (p.images as string[])?.[0] ?? "";
        // Ensure the path is absolute so it resolves correctly from any route
        const src = raw && !raw.startsWith("http") && !raw.startsWith("/") ? `/${raw}` : raw;
        return [p.id, src];
      })
    );
  }

  return (
    <>
      <AdminBar />
      <OrderDetailClient order={order} productImages={productImages} />
    </>
  );
}
