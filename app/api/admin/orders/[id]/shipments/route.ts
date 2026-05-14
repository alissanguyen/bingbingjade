import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

const EVENTS_AVAILABLE_NOW = [
  { event_key: "confirmed",  label: "Order Confirmed", description: "Order placed and payment received.",        sort_order: 0, is_current: true,  is_completed: false },
  { event_key: "packing",    label: "Packing",         description: "Your piece is being carefully packaged.",   sort_order: 1, is_current: false, is_completed: false },
  { event_key: "shipped",    label: "Shipped",          description: "Your order is on its way to you.",          sort_order: 2, is_current: false, is_completed: false },
  { event_key: "delivered",  label: "Delivered",        description: "Your piece has arrived.",                  sort_order: 3, is_current: false, is_completed: false },
];

const EVENTS_SOURCED = [
  { event_key: "confirmed",          label: "Order Confirmed",        description: "Order placed and payment received.",                             sort_order: 0, is_current: true,  is_completed: false },
  { event_key: "quality_inspection", label: "Quality Inspection",     description: "Your piece is being carefully inspected to meet our standards.", sort_order: 1, is_current: false, is_completed: false },
  { event_key: "certification",      label: "Certification",          description: "Your jade is undergoing authentication and certification.",      sort_order: 2, is_current: false, is_completed: false },
  { event_key: "arriving_at_studio", label: "Arriving at Our Studio", description: "Your piece is on its way to our studio for final handling.",     sort_order: 3, is_current: false, is_completed: false },
  { event_key: "shipped",            label: "Shipped",                description: "Your order has been carefully packaged and shipped.",            sort_order: 4, is_current: false, is_completed: false },
  { event_key: "delivered",          label: "Delivered",              description: "Your piece has arrived. We hope it brings you lasting beauty.",  sort_order: 5, is_current: false, is_completed: false },
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;
  const body = await req.json() as {
    fulfillment_type?: "available_now" | "sourced_for_you";
    carrier?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
    estimated_delivery_start?: string | null;
    estimated_delivery_end?: string | null;
  };

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number")
    .eq("id", orderId)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { count } = await supabaseAdmin
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);

  const suffix = `S${(count ?? 0) + 1}`;
  const shipmentNumber = order.order_number ? `${order.order_number}-${suffix}` : null;
  const fulfillmentType = body.fulfillment_type ?? "sourced_for_you";

  const { data: shipment, error } = await supabaseAdmin
    .from("shipments")
    .insert({
      order_id: orderId,
      shipment_number: shipmentNumber,
      fulfillment_type: fulfillmentType,
      status: "processing",
      carrier: body.carrier ?? null,
      tracking_number: body.tracking_number ?? null,
      tracking_url: body.tracking_url ?? null,
      estimated_delivery_start: body.estimated_delivery_start ?? null,
      estimated_delivery_end: body.estimated_delivery_end ?? null,
    })
    .select("*")
    .single();

  if (error || !shipment)
    return NextResponse.json({ error: error?.message ?? "Failed to create shipment" }, { status: 500 });

  const eventTemplate = fulfillmentType === "available_now" ? EVENTS_AVAILABLE_NOW : EVENTS_SOURCED;
  const { data: events } = await supabaseAdmin
    .from("shipment_events")
    .insert(eventTemplate.map((e) => ({ ...e, shipment_id: shipment.id })))
    .select("*");

  return NextResponse.json({ shipment, events: events ?? [] });
}
