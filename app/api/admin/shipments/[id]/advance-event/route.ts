import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

// Maps event_key → shipment.status
function eventKeyToStatus(key: string): string {
  if (key === "shipped") return "shipped";
  if (key === "delivered") return "delivered";
  if (key === "confirmed") return "confirmed";
  return "processing";
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

  // Mark current as completed
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: false, is_completed: true, event_time: now })
    .eq("id", currentEvent.id);

  // Mark next as current
  await supabaseAdmin
    .from("shipment_events")
    .update({ is_current: true })
    .eq("id", nextEvent.id);

  // Update shipment status + timestamps
  const shipmentUpdates: Record<string, unknown> = {
    status: eventKeyToStatus(nextEvent.event_key),
    updated_at: now,
  };
  if (nextEvent.event_key === "shipped")   shipmentUpdates.shipped_at = now;
  if (nextEvent.event_key === "delivered") shipmentUpdates.delivered_at = now;

  await supabaseAdmin
    .from("shipments")
    .update(shipmentUpdates)
    .eq("id", id);

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

  return NextResponse.json({ events: updatedEvents, shipment: updatedShipment });
}
