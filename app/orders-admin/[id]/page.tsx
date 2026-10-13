import { notFound } from "next/navigation";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { computeOrderRevenue, type OrderPaymentLedgerRow, type ClaimRefundLedgerRow } from "@/lib/revenue";
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

  // Strip server-only profit fields before serializing to the client component
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cogs_cents: _cogs, ...orderForClient } = order as typeof order & { cogs_cents?: unknown };

  // Fetch shipments separately — safe to fail before migration_042 is run
  let shipments: unknown[] = [];
  try {
    const { data } = await supabaseAdmin
      .from("shipments")
      .select(`
        *,
        shipment_events(*),
        shipment_items(id, order_item_id)
      `)
      .eq("order_id", id);
    shipments = data ?? [];
  } catch {
    // Table doesn't exist yet — page loads without shipment data
  }

  // Fetch product images for each order item that has a product_id
  const productIds = (order.order_items as { product_id: string | null }[])
    .map((i) => i.product_id)
    .filter((id): id is string => !!id);

  let productImages: Record<string, string> = {};
  let productCogs: Record<string, number> = {};
  let productLinks: Record<string, string> = {};
  if (productIds.length > 0) {
    const [{ data: products }, { data: costs }] = await Promise.all([
      supabaseAdmin.from("products").select("id, images, slug, public_id").in("id", productIds),
      supabaseAdmin.from("product_costs").select("product_id, total_cogs_usd").in("product_id", productIds),
    ]);

    // resolveFirstImageUrl converts storage paths (wm/file.jpg) → full public URLs
    const resolved = await Promise.all(
      (products ?? []).map(async (p) => {
        const url = await resolveFirstImageUrl(p.images as string[]);
        return [p.id, url ?? ""] as [string, string];
      })
    );
    productImages = Object.fromEntries(resolved);
    productCogs = Object.fromEntries(
      (costs ?? []).map((c) => [c.product_id, Number(c.total_cogs_usd)])
    );
    productLinks = Object.fromEntries(
      (products ?? [])
        .filter((p) => p.slug && p.public_id)
        .map((p) => [p.id, `/products/${p.slug}-${p.public_id}`])
    );
  }

  // Canonical revenue breakdown (lib/revenue.ts) — same calculation the
  // Orders admin table and every accounting report use, so this page can
  // never show a different "new revenue" number than they do. Only needed
  // when store credit was involved; otherwise new revenue is amount_total.
  let revenue = null as ReturnType<typeof computeOrderRevenue> | null;
  if ((order.store_credit_used_cents ?? 0) > 0) {
    const [{ data: payments }, { data: claimRefunds }] = await Promise.all([
      supabaseAdmin.from("order_payments").select("amount_paid_usd, payment_status").eq("order_id", id),
      supabaseAdmin.from("claim_refunds").select("amount_usd, status").eq("order_id", id),
    ]);
    revenue = computeOrderRevenue(
      { amountTotalCents: order.amount_total, storeCreditUsedCents: order.store_credit_used_cents, orderStatus: order.order_status },
      (payments ?? []) as OrderPaymentLedgerRow[],
      (claimRefunds ?? []) as ClaimRefundLedgerRow[]
    );
  }

  return (
    <>
      <AdminBarServer />
      <OrderDetailClient order={{ ...orderForClient, shipments }} productImages={productImages} productCogs={productCogs} productLinks={productLinks} revenue={revenue} />
    </>
  );
}
