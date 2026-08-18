import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { packagingAcknowledge, PACKAGING_ACK_TEXT } from "@/lib/claims";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderNumber: string; claimId: string }> }) {
  const { orderNumber, claimId } = await params;
  const { data: order } = await supabaseAdmin.from("orders").select("id, customer_email").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const { data: claim } = await supabaseAdmin.from("claims").select("id").eq("id", claimId).eq("order_id", order.id).maybeSingle();
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });

  const updated = await packagingAcknowledge({
    claimId,
    customerEmail: order.customer_email ?? "customer",
    policyText: PACKAGING_ACK_TEXT,
  });

  return NextResponse.json({ ok: true, packagingAckAt: updated.packaging_ack_at });
}
