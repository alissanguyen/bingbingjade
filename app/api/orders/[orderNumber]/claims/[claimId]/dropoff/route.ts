import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reportCustomerDropoff } from "@/lib/claims";

// Customer clicking "I've dropped off my return". This is NOT treated as
// objective proof of carrier possession (§11) — it only sets
// customer_dropoff_reported_at. carrier_acceptance_scan_at is set separately
// by an admin (or a future carrier-webhook integration) once the carrier
// actually scans the package.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNumber: string; claimId: string }> }) {
  const { orderNumber, claimId } = await params;
  const { data: order } = await supabaseAdmin.from("orders").select("id, customer_email").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const { data: claim } = await supabaseAdmin.from("claims").select("id").eq("id", claimId).eq("order_id", order.id).maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const { data: ret } = await supabaseAdmin.from("returns").select("id").eq("claim_id", claimId).maybeSingle();
  if (!ret) return NextResponse.json({ error: "No return on this claim." }, { status: 400 });

  const { data: shipment } = await supabaseAdmin
    .from("return_shipments")
    .select("id")
    .eq("return_id", ret.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!shipment) return NextResponse.json({ error: "No return label on file yet." }, { status: 400 });

  await reportCustomerDropoff({
    returnShipmentId: shipment.id,
    returnId: ret.id,
    claimId,
    customerEmail: order.customer_email ?? "customer",
  });

  return NextResponse.json({ ok: true });
}
