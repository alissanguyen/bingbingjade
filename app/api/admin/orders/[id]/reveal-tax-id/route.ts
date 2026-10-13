import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSessionUser, isApproved, approvedCreatedBy, SessionUser } from "@/lib/approved-auth";
import { decryptTaxId } from "@/lib/tax-id";

// POST /api/admin/orders/[id]/reveal-tax-id
// Decrypts the recipient's tax ID for display and records an audit row —
// this is a deliberate, logged action, never returned by the plain order GET.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let query = supabaseAdmin
    .from("orders")
    .select("id, shipping_address_id")
    .eq("id", id);

  if (isApproved(session)) {
    query = query.eq("created_by", approvedCreatedBy((session as Extract<SessionUser, { type: "approved" }>).user.id));
  }

  const { data: order, error } = await query.maybeSingle();
  if (error || !order || !order.shipping_address_id) {
    return NextResponse.json({ error: "Order or address not found" }, { status: 404 });
  }

  const { data: address } = await supabaseAdmin
    .from("customer_addresses")
    .select("id, tax_id_ciphertext")
    .eq("id", order.shipping_address_id)
    .maybeSingle();

  if (!address?.tax_id_ciphertext) {
    return NextResponse.json({ error: "No tax ID on file for this order" }, { status: 404 });
  }

  let taxId: string;
  try {
    taxId = decryptTaxId(address.tax_id_ciphertext);
  } catch (err) {
    console.error("[reveal-tax-id] Decryption failed:", err);
    return NextResponse.json({ error: "Unable to decrypt tax ID" }, { status: 500 });
  }

  await supabaseAdmin.from("tax_id_reveals").insert({
    order_id: order.id,
    address_id: address.id,
    revealed_by_type: isApproved(session) ? "approved" : "admin",
    revealed_by_id: isApproved(session) ? (session as Extract<SessionUser, { type: "approved" }>).user.id : null,
    revealed_by_label: isApproved(session) ? (session as Extract<SessionUser, { type: "approved" }>).user.email : "admin",
  });

  return NextResponse.json({ taxId });
}
