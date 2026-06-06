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

  // Fetch all events for this shipment, ordered by sort_order
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

  const currentEvent = events[currentIdx];
  const nextEvent = events[currentIdx + 1] ?? null;

  if (!nextEvent)
    return NextResponse.json({ error: "Already at final event" }, { status: 400 });

  const now = new Date().toISOString();

  // Mark current as completed — preserve its event_time (set when it became current)
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: false, is_completed: true })
    .eq("id", currentEvent.id);

  // Mark next as current and stamp the moment it becomes active
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: true, event_time: now })
    .eq("id", nextEvent.id);

  // Update shipment status + timestamps
  const shipmentUpdates: Record<string, unknown> = {
    status: eventKeyToShipmentStatus(nextEvent.event_key),
    updated_at: now,
  };
  if (nextEvent.event_key === "shipped")   shipmentUpdates.shipped_at = now;
  if (nextEvent.event_key === "delivered") shipmentUpdates.delivered_at = now;

  await supabaseAdmin
    .from("shipments")
    .update(shipmentUpdates)
    .eq("id", id);

  // Sync order_status to match the new shipment event
  const { data: shipment } = await supabaseAdmin
    .from("shipments")
    .select("order_id")
    .eq("id", id)
    .single();

  let newOrderStatus: string | null = null;
  if (shipment?.order_id) {
    newOrderStatus = eventKeyToOrderStatus(nextEvent.event_key);
    if (newOrderStatus) {
      await supabaseAdmin
        .from("orders")
        .update({ order_status: newOrderStatus })
        .eq("id", shipment.order_id);
    }
  }

  // Return updated events + shipment
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

  return NextResponse.json({ events: updatedEvents, shipment: updatedShipment, newOrderStatus });
}
