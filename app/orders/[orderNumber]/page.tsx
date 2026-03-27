import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import type { OrderStatus } from "@/types/orders";
import ReviewForm from "./ReviewForm";
import OrderTimeline from "./OrderTimeline";

// Revalidate every 5 minutes so status updates surface quickly
export const revalidate = 300;

// ── Status timeline ────────────────────────────────────────────────────────

type StatusStep = { key: OrderStatus; label: string; description: string };

const STANDARD_STEPS: StatusStep[] = [
  {
    key: "order_confirmed",
    label: "Order Confirmed",
    description: "Your order has been successfully placed and payment received. We’re preparing your piece with care.",
  },
  {
    key: "quality_control",
    label: "Quality Inspection",
    description: "Each piece is carefully inspected to ensure it meets our quality standards before moving forward.",
  },
  {
    key: "certifying",
    label: "Certification",
    description: "Your jade is undergoing authentication and certification for assurance and authenticity.",
  },
  {
    key: "inbound_shipping",
    label: "Arriving at Our Studio",
    description: "Your piece is currently in transit to our studio for final handling and preparation. ♡",
  },
  {
    key: "outbound_shipping",
    label: "On the Way to You",
    description: "Your order has been carefully packaged and is now on its way to you.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your piece has arrived. We hope it brings you lasting beauty and meaning. ♡ ♡ ♡",
  },
];

const CUSTOM_STEPS: StatusStep[] = [
  {
    key: "order_confirmed",
    label: "Order Confirmed",
    description: "Your custom commission has been received and confirmed. We’re excited to begin crafting your piece.",
  },
  {
    key: "in_production",
    label: "In Production",
    description: "Your piece is being carefully handcrafted, with attention to every detail.",
  },
  {
    key: "polishing",
    label: "Finishing & Polishing",
    description: "The piece is undergoing final refinement to achieve its intended clarity, shape, and finish.",
  },
  {
    key: "quality_control",
    label: "Quality Inspection",
    description: "We are carefully reviewing your finished piece to ensure it meets our standards.",
  },
  {
    key: "certifying",
    label: "Certification",
    description: "Your jade is being authenticated and certified for complete peace of mind.",
  },
  {
    key: "inbound_shipping",
    label: "Arriving at Our Studio",
    description: "Your piece is on its way to our studio for final preparation before dispatch.",
  },
  {
    key: "outbound_shipping",
    label: "On the Way to You",
    description: "Your order has been securely packaged and is now on its way to you.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your custom piece has arrived. Thank you for trusting us with something so personal. ♥ ♥ ♥",
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
      fee_breakdown,
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
          <OrderTimeline
            steps={statusSteps}
            currentStatus={currentStatus}
            isCustom={isCustom}
            statusOrder={isCustom ? CUSTOM_ORDER : STANDARD_ORDER}
          />
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
            <div className="bg-gray-50 dark:bg-gray-900 px-5 py-3.5 space-y-1.5">
              {(() => {
                const fb = order.fee_breakdown as { shipping?: number; tax?: number; paypal?: number; insurance?: number; discount?: number; other?: number; otherLabel?: string } | null;
                const itemsSubtotal = items.reduce((s, i) => s + (i.line_total ?? (i.price_usd ?? 0) * i.quantity), 0);
                const hasFees = fb && ((fb.shipping ?? 0) + (fb.tax ?? 0) + (fb.paypal ?? 0) + (fb.insurance ?? 0) + (fb.discount ?? 0) + (fb.other ?? 0)) > 0;
                return (
                  <>
                    {hasFees && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Subtotal</span><span>${itemsSubtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.shipping ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Shipping</span><span>+${fb!.shipping!.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.tax ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Tax</span><span>+${fb!.tax!.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.paypal ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>PayPal Fee</span><span>+${fb!.paypal!.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.insurance ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Insurance</span><span>+${fb!.insurance!.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <span>Discount</span><span>−${fb!.discount!.toFixed(2)}</span>
                      </div>
                    )}
                    {(fb?.other ?? 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{fb!.otherLabel ?? "Other"}</span><span>+${fb!.other!.toFixed(2)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between items-center ${hasFees ? "pt-1 border-t border-gray-200 dark:border-gray-700" : ""}`}>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total paid</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalFormatted}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Reassurance note */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">About your order timeline</p>
        <p>
          Authentic jadeite requires careful sourcing, independent certification, and international
          shipping — each step takes time. This page will reflect your order&apos;s progress. If you have
          questions at any point, please reach out via{" "}
          <Link
            href="/contact"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            our contact form
          </Link>{" "}
          or WhatsApp. We&apos;re always happy to provide a personal update.
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
