import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";

// DELETE /api/admin/reservations/[id] — cancel reservation and un-reserve the product
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: reservation, error: fetchError } = await supabaseAdmin
    .from("product_reservations")
    .select("id, product_id")
    .eq("id", id)
    .is("cancelled_at", null)
    .single();

  if (fetchError || !reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Cancel the reservation
  const { error: cancelError } = await supabaseAdmin
    .from("product_reservations")
    .update({ cancelled_at: now })
    .eq("id", id);

  if (cancelError) {
    return NextResponse.json({ error: cancelError.message }, { status: 500 });
  }

  // Restore product to available
  await supabaseAdmin
    .from("products")
    .update({
      status: "available",
      reserved_until: null,
      reserved_for_handle: null,
    })
    .eq("id", reservation.product_id)
    .eq("status", "reserved");

  return NextResponse.json({ success: true });
}
