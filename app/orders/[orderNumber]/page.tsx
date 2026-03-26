import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import type { OrderStatus } from "@/types/orders";
import ReviewForm from "./ReviewForm";

// Revalidate every 5 minutes so status updates surface quickly
export const revalidate = 300;

// ── Status timeline ────────────────────────────────────────────────────────

type StatusStep = { key: OrderStatus; label: string; description: string };

const STANDARD_STEPS: StatusStep[] = [
  {
    key: "order_confirmed",
    label: "Order Confirmed",
    description: "Payment received. Your order is in our system.",
  },
  {
    key: "quality_control",
    label: "Quality Control",
    description: "Our team is carefully inspecting your piece.",
  },
  {
    key: "certifying",
    label: "Certification",
    description: "Your jade is being authenticated and certified.",
  },
  {
    key: "inbound_shipping",
    label: "Shipping to Our Location",
    description: "The piece is on its way to our main location.",
  },
  {
    key: "outbound_shipping",
    label: "On the Way to You",
    description: "Your order has been dispatched and is heading your way.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your order has arrived. Enjoy your piece.",
  },
];

const CUSTOM_STEPS: StatusStep[] = [
  {
    key: "order_confirmed",
    label: "Order Confirmed",
    description: "Your commission has been received and confirmed.",
  },
  {
    key: "in_production",
    label: "In Production",
    description: "Your piece is being hand-crafted in the factory.",
  },
  {
    key: "polishing",
    label: "Finishing & Polishing",
    description: "The piece is receiving its final surface refinement and polish.",
  },
  {
    key: "quality_control",
    label: "Quality Control",
    description: "Our team is carefully inspecting your finished piece.",
  },
  {
    key: "certifying",
    label: "Certification",
    description: "Your jade is being authenticated and certified.",
  },
  {
    key: "inbound_shipping",
    label: "Shipping to Our Location",
    description: "The piece is on its way to our main location.",
  },
  {
    key: "outbound_shipping",
    label: "On the Way to You",
    description: "Your order has been dispatched and is heading your way.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your order has arrived. Enjoy your piece.",
  },
];

// order_created is a pre-confirmation state (admin/manual orders not yet confirmed)
const STANDARD_ORDER: OrderStatus[] = [
  "order_created", "order_confirmed", "quality_control",
  "certifying", "inbound_shipping", "outbound_shipping", "delivered", "order_cancelled",
];

const CUSTOM_ORDER: OrderStatus[] = [
  "order_created", "order_confirmed", "in_production", "polishing",
  "quality_control", "certifying", "inbound_shipping", "outbound_shipping", "delivered", "order_cancelled",
];

// Statuses that only exist in a custom order workflow
const CUSTOM_ONLY_STATUSES: OrderStatus[] = ["in_production", "polishing"];

function resolveIsCustom(orderType: string | null, currentStatus: OrderStatus): boolean {
  // Trust the order_type field first; fall back to checking if the current
  // status only exists in a custom workflow (guards against null/missing column)
  return orderType === "custom" || CUSTOM_ONLY_STATUSES.includes(currentStatus);
}

function getSteps(isCustom: boolean) {
  return isCustom ? CUSTOM_STEPS : STANDARD_STEPS;
}

function statusIndex(status: OrderStatus, isCustom: boolean): number {
  return (isCustom ? CUSTOM_ORDER : STANDARD_ORDER).indexOf(status);
}

// ── Data fetch ─────────────────────────────────────────────────────────────
async function getOrder(orderNumber: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(`
      id,
      order_number,
      created_at,
      amount_total,
      currency,
      order_status,
      order_type,
      estimated_delivery_date,
      customer_name,
      order_items (
        product_id,
        product_name,
        option_label,
        price_usd,
        quantity,
        line_total
      )
    `)
    .eq("order_number", orderNumber.toUpperCase())
    .maybeSingle();

  if (!order) return null;

  // Resolve product images and slugs for each item that has a product_id
  const productIds = (order.order_items as { product_id: string | null }[])
    .map((i) => i.product_id)
    .filter((id): id is string => !!id);

  type ProductMeta = { id: string; imageUrl: string; href: string };
  let productMeta: Record<string, ProductMeta> = {};

  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, images, slug, public_id")
      .in("id", productIds);

    const resolved = await Promise.all(
      (products ?? []).map(async (p) => {
        const imageUrl = await resolveFirstImageUrl(p.images as string[]) ?? "";
        const href = p.slug && p.public_id
          ? `/products/${p.slug}-${p.public_id}`
          : `/products/${p.public_id}`;
        return [p.id, { id: p.id, imageUrl, href }] as [string, ProductMeta];
      })
    );
    productMeta = Object.fromEntries(resolved);
  }

  // Fetch existing review (if any)
  const { data: review } = await supabaseAdmin
    .from("reviews")
    .select("rating, description, date_rated")
    .eq("order_id", order.id)
    .maybeSingle();

  return { ...order, productMeta, existingReview: review ?? null };
}

// ── Metadata ───────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Order ${orderNumber.toUpperCase()}`,
    description: "Track your BingBing Jade order status.",
    robots: { index: false, follow: false },
  };
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getOrder(orderNumber);

  if (!order) notFound();

  const currentStatus = order.order_status as OrderStatus;
  const isCustom = resolveIsCustom(order.order_type as string | null, currentStatus);
  const currentIdx = statusIndex(currentStatus, isCustom);
  const isDelivered = currentStatus === "delivered";
  const isPreConfirm = currentStatus === "order_created";
  const statusSteps = getSteps(isCustom);

  const orderDate = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalFormatted =
    order.amount_total != null
      ? `$${(order.amount_total / 100).toFixed(2)}`
      : "—";

  const items = (order.order_items ?? []) as {
    product_id: string | null;
    product_name: string;
    option_label: string | null;
    price_usd: number | null;
    quantity: number;
    line_total: number | null;
  }[];
  const { productMeta, existingReview } = order;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">
          Order Tracking
        </p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {order.order_number}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Placed on {orderDate}
          {order.customer_name && (
            <> · <span className="text-gray-600 dark:text-gray-300">{order.customer_name.split(" ")[0]}</span></>
          )}
        </p>
      </div>

      {/* Pre-confirmation notice (no timeline yet) */}
      {isPreConfirm && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 mb-10 flex items-start gap-3">
          <div className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400 animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Awaiting Confirmation</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              Your order has been received and is awaiting confirmation from our team.
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!isPreConfirm && (
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-5">
            Progress
          </h2>
          <ol className="relative">
            {statusSteps.map((step, idx) => {
              const stepIdx = statusIndex(step.key, isCustom);
              const isCompleted = stepIdx < currentIdx;
              const isCurrent = step.key === currentStatus;
              const isPending = stepIdx > currentIdx;

              return (
                <li key={step.key} className="flex gap-4 pb-7 last:pb-0">
                  {/* Line + dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500"
                          : isCurrent
                          ? "bg-amber-400 border-amber-400"
                          : "bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700"
                      }`}
                    />
                    {idx < statusSteps.length - 1 && (
                      <div
                        className={`w-px flex-1 mt-1 ${
                          isCompleted ? "bg-emerald-400 dark:bg-emerald-700" : "bg-gray-200 dark:bg-gray-800"
                        }`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-1 flex-1 ${isCurrent ? "rounded-lg bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 px-3 py-2 -mt-0.5" : ""}`}>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? "text-amber-800 dark:text-amber-200"
                            : isCompleted
                            ? "text-gray-600 dark:text-gray-400"
                            : "text-gray-400 dark:text-gray-600"
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <span className="text-xs font-semibold bg-amber-400/20 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 leading-none">
                          Current
                        </span>
                      )}
                      {isCompleted && (
                        <svg
                          className="text-emerald-500 shrink-0"
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    {isCurrent && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Estimated delivery */}
      {order.estimated_delivery_date && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1">
            Estimated Delivery
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {new Date(order.estimated_delivery_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Order summary */}
      {items.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-4">
            Order Summary
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {items.map((item, i) => {
              const meta = item.product_id ? productMeta[item.product_id] : null;
              const price = item.line_total != null
                ? `$${item.line_total.toFixed(2)}`
                : item.price_usd != null
                ? `$${item.price_usd.toFixed(2)}`
                : "—";
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-emerald-50 dark:bg-emerald-950 shrink-0">
                    {meta?.imageUrl ? (
                      <Image
                        src={meta.imageUrl}
                        alt={item.product_name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🪨</div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {meta?.href ? (
                      <Link href={meta.href} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400 leading-snug transition-colors line-clamp-2">
                        {item.product_name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{item.product_name}</p>
                    )}
                    {item.option_label && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.option_label}</p>
                    )}
                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Qty: {item.quantity}</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-4 shrink-0">{price}</p>
                </div>
              );
            })}
            <div className="flex justify-between items-center px-5 py-3.5 bg-gray-50 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total paid</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalFormatted}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reassurance note */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">About your order timeline</p>
        <p>
          Authentic jadeite requires careful sourcing, independent certification, and international
          shipping — each step takes time. This page will reflect your order's progress. If you have
          questions at any point, please reach out via{" "}
          <Link
            href="/contact"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            our contact form
          </Link>{" "}
          or WhatsApp. We're always happy to provide a personal update.
        </p>
      </div>

      {/* Review form — delivered orders only */}
      {isDelivered && (
        <div id="review">
          <ReviewForm
            orderNumber={order.order_number}
            existingReview={existingReview}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          Browse Products
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
