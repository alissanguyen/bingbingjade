export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { ClearCartOnSuccess } from "./ClearCartOnSuccess";
import { TrackPurchaseOnSuccess } from "./TrackPurchaseOnSuccess";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata = {
  title: "Order Confirmed",
};

const BANNER_IMG = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

type OrderData = {
  order_number: string;
  total_price_usd: number | null;
  order_items: { product_name: string | null; price_usd: number; quantity: number }[];
};

async function getOrderData(sessionId: string): Promise<OrderData | null> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("order_number, total_price_usd, order_items(product_name, price_usd, quantity)")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (!data) return null;
  return {
    order_number: data.order_number,
    total_price_usd: data.total_price_usd ?? null,
    order_items: Array.isArray(data.order_items) ? (data.order_items as OrderData["order_items"]) : [],
  };
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Try to fetch order data from DB — may be null if webhook hasn't fired yet.
  // The confirmation email contains the order number as the authoritative reference.
  let orderNumber: string | null = null;
  let orderData: OrderData | null = null;
  if (session_id) {
    orderData = await getOrderData(session_id).catch(() => null);
    orderNumber = orderData?.order_number ?? null;
  }

  return (
    <div>
      <ClearCartOnSuccess />
      {orderData && orderData.total_price_usd != null && orderData.order_items.length > 0 && (
        <TrackPurchaseOnSuccess
          orderId={orderData.order_number}
          value={orderData.total_price_usd}
          items={orderData.order_items.map((item, i) => ({
            itemId: `${orderData!.order_number}-${i}`,
            itemName: item.product_name ?? "Jade Piece",
            price: item.price_usd,
            quantity: item.quantity,
          }))}
        />
      )}

      {/* Banner */}
      <div className="relative w-full h-[55vh] min-h-96 overflow-hidden">
        <Image
          src={BANNER_IMG}
          alt="Order confirmed"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/30 via-black/25 to-black/65" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 mt-6 sm:mt-0">
          {/* Checkmark */}
          <div className="mb-6 w-16 h-16 rounded-full bg-white/10 border border-white/30 backdrop-blur-sm flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-300"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-4">
            Purchase Confirmed ✓
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight drop-shadow-lg max-w-2xl">
            Thank you — your piece has been secured.
          </h1>
          <p className="mt-5 text-base text-white/75 max-w-md leading-relaxed">
            Each piece is carefully prepared and verified before shipment. Our team will personally
            reach out within 24–48 hours to confirm your order details and arrange shipping.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {orderNumber ? (
              <Link
                href={`/orders/${orderNumber}`}
                className="rounded-full bg-emerald-700 hover:bg-emerald-600 px-7 py-3 text-sm font-semibold text-white transition-colors shadow-lg"
              >
                Track Order {orderNumber}
              </Link>
            ) : (
              <Link
                href="/products"
                className="rounded-full bg-emerald-700 hover:bg-emerald-600 px-7 py-3 text-sm font-semibold text-white transition-colors shadow-lg"
              >
                Continue Browsing
              </Link>
            )}
            <Link
              href="/contact"
              className="rounded-full border border-white/60 hover:border-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-7 py-3 text-sm font-semibold text-white transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="flex justify-center py-8 px-6">
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-md">
          {orderNumber ? (
            <>
              Your order number is{" "}
              <span className="font-semibold text-gray-600 dark:text-gray-300">{orderNumber}</span>.
              {" "}A confirmation email is on its way with a link to track your order.{" "}
              If it doesn&apos;t arrive within a few minutes, please check your spam or promotions folder.
            </>
          ) : (
            <>
              A confirmation email is on its way with your BingBing Jade order number and a tracking
              link. If it doesn&apos;t arrive within a few minutes, please check your spam or promotions folder.
              For any questions, reach out via WhatsApp or our contact form.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
