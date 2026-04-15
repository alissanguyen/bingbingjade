import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// POST — customer discards their pending checkout and resumes sourcing
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: req } = await supabaseAdmin
    .from("sourcing_requests")
    .select("id, sourcing_status, payment_status")
    .eq("public_token", token)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (req.payment_status !== "paid") return NextResponse.json({ error: "Deposit not paid." }, { status: 400 });
  if (req.sourcing_status !== "accepted_pending_checkout") {
    return NextResponse.json({ error: "No active checkout to discard." }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Find and expire the pending checkout offer
  const { data: offer } = await supabaseAdmin
    .from("sourcing_checkout_offers")
    .select("id, sourcing_attempt_option_id")
    .eq("sourcing_request_id", req.id)
    .eq("status", "pending_checkout")
    .maybeSingle();

  if (offer) {
    // Revert the accepted option back to active
    if (offer.sourcing_attempt_option_id) {
      await supabaseAdmin
        .from("sourcing_attempt_options")
        .update({ status: "active", updated_at: now })
        .eq("id", offer.sourcing_attempt_option_id)
        .eq("status", "converted_to_checkout");
    }
    await supabaseAdmin
      .from("sourcing_checkout_offers")
      .update({ status: "expired", updated_at: now })
      .eq("id", offer.id);
  }

  // Set request back to in_progress so admin can send another round
  await supabaseAdmin
    .from("sourcing_requests")
    .update({ sourcing_status: "in_progress", updated_at: now })
    .eq("id", req.id);

  return NextResponse.json({ ok: true });
}
