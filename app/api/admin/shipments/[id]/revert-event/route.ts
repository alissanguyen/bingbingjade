import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

function eventKeyToShipmentStatus(key: string): string {
  if (key === "shipped") return "shipped";
  if (key === "delivered") return "delivered";
  if (key === "confirmed") return "confirmed";
  return "processing";
}

function eventKeyToOrderStatus(key: string): string | null {
  if (key === "delivered") return "delivered";
  if (key === "shipped") return "outbound_shipping";
  if (key === "inbound" || key === "inbound_shipping" || key === "arriving") return "inbound_shipping";
  if (key === "certifying" || key === "certification") return "certifying";
  if (key === "quality_inspection" || key === "quality_control") return "quality_control";
  if (key === "polishing" || key === "finishing") return "polishing";
  if (key === "in_production" || key === "production") return "in_production";
  if (key === "confirmed") return "order_confirmed";
  return null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: events, error: evErr } = await supabaseAdmin
    .from("shipment_events")
    .select("*")
    .eq("shipment_id", id)
    .order("sort_order", { ascending: true });

  if (evErr || !events)
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const currentIdx = events.findIndex((e) => e.is_current);
  if (currentIdx === -1)
    return NextResponse.json({ error: "No current event found" }, { status: 400 });

  if (currentIdx === 0)
    return NextResponse.json({ error: "Already at first event" }, { status: 400 });

  const currentEvent = events[currentIdx];
  const prevEvent = events[currentIdx - 1];

  // Un-complete current
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: false, is_completed: false, event_time: null })
    .eq("id", currentEvent.id);

  // Make previous current again
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: true, is_completed: false })
    .eq("id", prevEvent.id);

  // Revert shipment status + clear timestamps if reverting delivered/shipped
  const shipmentUpdates: Record<string, unknown> = {
    status: eventKeyToShipmentStatus(prevEvent.event_key),
    updated_at: new Date().toISOString(),
  };
  if (currentEvent.event_key === "delivered") shipmentUpdates.delivered_at = null;
  if (currentEvent.event_key === "shipped") shipmentUpdates.shipped_at = null;

  await supabaseAdmin.from("shipments").update(shipmentUpdates).eq("id", id);

  // Sync order_status if we can determine it
  const { data: shipment } = await supabaseAdmin
    .from("shipments")
    .select("order_id")
    .eq("id", id)
    .single();

  if (shipment?.order_id) {
    const newOrderStatus = eventKeyToOrderStatus(prevEvent.event_key);
    if (newOrderStatus) {
      await supabaseAdmin
        .from("orders")
        .update({ order_status: newOrderStatus })
        .eq("id", shipment.order_id);
    }
  }

  const { data: updatedEvents } = await supabaseAdmin
    .from("shipment_events")
    .select("*")
    .eq("shipment_id", id)
    .order("sort_order", { ascending: true });

  const { data: updatedShipment } = await supabaseAdmin
    .from("shipments")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({
    events: updatedEvents,
    shipment: updatedShipment,
    newOrderStatus: shipment?.order_id ? eventKeyToOrderStatus(prevEvent.event_key) : null,
  });
}
