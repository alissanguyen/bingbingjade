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

// ── Tracking URL helper ────────────────────────────────────────────────────

function buildTrackingUrl(
  carrier: string | null,
  trackingNumber: string | null,
  customUrl: string | null,
): string | null {
  if (customUrl) {
    return customUrl.startsWith("http://") || customUrl.startsWith("https://")
      ? customUrl
      : `https://${customUrl}`;
  }
  if (!trackingNumber) return null;
  const c = (carrier ?? "").toLowerCase();
  if (c === "ups") return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c === "usps") return `https://tools.usps.com/go/TrackAction?tLabels=${trackingNumber}`;
  return null;
}

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
        id,
        product_id,
        product_name,
        option_label,
        price_usd,
        quantity,
        line_total
      ),
      shipments (
        id,
        shipment_number,
        fulfillment_type,
        status,
        carrier,
        tracking_number,
        tracking_url,
        estimated_delivery_start,
        estimated_delivery_end,
        shipped_at,
        delivered_at,
        shipment_events (
          id, event_key, label, description,
          event_time, is_current, is_completed, sort_order
        ),
        shipment_items (
          id, order_item_id
        )
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
    id: string;
    product_id: string | null;
    product_name: string;
    option_label: string | null;
    price_usd: number | null;
    quantity: number;
    line_total: number | null;
  }[];

  type RawShipment = {
    id: string;
    shipment_number: string | null;
    fulfillment_type: string | null;
    status: string;
    carrier: string | null;
    tracking_number: string | null;
    tracking_url: string | null;
    estimated_delivery_start: string | null;
    estimated_delivery_end: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    shipment_events: { id: string; event_key: string; label: string; description: string | null; event_time: string | null; is_current: boolean; is_completed: boolean; sort_order: number }[];
    shipment_items: { id: string; order_item_id: string }[];
  };
  const shipments = ((order as Record<string, unknown>).shipments as RawShipment[] | undefined) ?? [];

  const { productMeta, existingReview } = order;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">
          Order Tracking
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
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

      {/* Per-shipment timeline cards */}
      {!isPreConfirm && shipments.length > 0 && (
        <div className="mb-10 space-y-6">
          {shipments.map((shipment) => {
            const sortedEvents = [...shipment.shipment_events].sort((a, b) => a.sort_order - b.sort_order);
            const shipmentItems = shipment.shipment_items
              .map((si) => items.find((i) => i.id === si.order_item_id))
              .filter(Boolean) as typeof items;
            const isMixed = shipments.length > 1;

            return (
              <div key={shipment.id} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Card header */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                  shipment.fulfillment_type === "available_now"
                    ? "bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900"
                    : "bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900"
                }`}>
                  <div>
                    {isMixed && (
                      <p className={`text-xs font-semibold uppercase tracking-wider ${
                        shipment.fulfillment_type === "available_now"
                          ? "text-sky-600 dark:text-sky-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}>
                        {shipment.fulfillment_type === "available_now" ? "Available Now" : "Sourced for You"}
                      </p>
                    )}
                    {!isMixed && (
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
                        Progress
                      </p>
                    )}
                    {shipmentItems.length > 0 && isMixed && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {shipmentItems.map((i) => i.product_name + (i.option_label ? ` — ${i.option_label}` : "")).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Estimated delivery window */}
                {(shipment.estimated_delivery_start || shipment.estimated_delivery_end) && (
                  <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-amber-50/50 dark:bg-amber-950/10">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Est. Delivery: </span>
                      {shipment.estimated_delivery_start
                        ? new Date(shipment.estimated_delivery_start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : ""}
                      {shipment.estimated_delivery_start && shipment.estimated_delivery_end && " – "}
                      {shipment.estimated_delivery_end
                        ? new Date(shipment.estimated_delivery_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : ""}
                    </p>
                  </div>
                )}

                {/* Tracking banner — shown when shipped or delivered */}
                {shipment.tracking_number && (() => {
                  const trackUrl = buildTrackingUrl(shipment.carrier, shipment.tracking_number, shipment.tracking_url);
                  if (!trackUrl) return null;
                  return (
                    <div className="px-5 py-3 border-b border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] sm:text-[16px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 mb-0.5">
                          {shipment.carrier ?? "Tracking"}
                        </p>
                        <p className="text-[12px] sm:text-[15px] font-mono text-gray-500 dark:text-gray-400 truncate">{shipment.tracking_number}</p>
                      </div>
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-1.5 transition-colors"
                      >
                        Track package
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  );
                })()}

                {/* Events timeline */}
                <div className="px-5 py-4">
                  <ol className="relative">
                    {sortedEvents.map((ev, idx) => (
                      <li key={ev.id} className="flex gap-4 pb-6 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
                            {ev.is_current && (
                              <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-60 animate-ping" />
                            )}
                            <div className={`w-3 h-3 rounded-full border-2 z-10 relative ${
                              ev.is_completed ? "bg-emerald-500 border-emerald-500" :
                              ev.is_current   ? "bg-amber-400 border-amber-400" :
                              "bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700"
                            }`} />
                          </div>
                          {idx < sortedEvents.length - 1 && (
                            <div className={`w-px flex-1 mt-1 ${ev.is_completed ? "bg-emerald-400 dark:bg-emerald-700" : "bg-gray-200 dark:bg-gray-800"}`} />
                          )}
                        </div>
                        <div className={`pb-1 flex-1 ${ev.is_current ? "rounded-lg border px-3 py-2 -mt-0.5 bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60" : ""}`}>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${
                              ev.is_current   ? "text-amber-800 dark:text-amber-200" :
                              ev.is_completed ? "text-gray-600 dark:text-gray-400" :
                              "text-gray-400 dark:text-gray-600"
                            }`}>
                              {ev.label}
                            </p>
                            {ev.is_current && (
                              <span className="text-xs font-semibold bg-amber-400/20 text-amber-700 dark:text-amber-300 rounded-full px-2 py-0.5 leading-none">
                                Current
                              </span>
                            )}
                            {ev.is_completed && (
                              <svg className="text-emerald-500 shrink-0" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {ev.event_time && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                                {new Date(ev.event_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          {ev.is_current && ev.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{ev.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback: old single timeline (when no shipments yet) */}
      {!isPreConfirm && shipments.length === 0 && (
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
          {order.estimated_delivery_date && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4 mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1">
                Estimated Delivery
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {new Date(order.estimated_delivery_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          )}
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
                        <span>Transaction Fee</span><span>+${fb!.paypal!.toFixed(2)}</span>
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
