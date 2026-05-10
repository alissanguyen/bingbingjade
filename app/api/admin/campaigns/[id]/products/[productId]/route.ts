import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/admin/campaigns/[id]/products/[productId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaign_id, productId: product_id } = await params;

  let body: { event_price_usd?: number | null; is_featured_for_email?: boolean; sort_order?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("event_price_usd" in body) patch.event_price_usd = body.event_price_usd ?? null;
  if ("is_featured_for_email" in body) patch.is_featured_for_email = Boolean(body.is_featured_for_email);
  if ("sort_order" in body) patch.sort_order = Number(body.sort_order);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("campaign_event_products")
    .update(patch)
    .eq("campaign_id", campaign_id)
    .eq("product_id", product_id)
    .select("id, event_price_usd, sort_order, is_featured_for_email")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// DELETE /api/admin/campaigns/[id]/products/[productId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaign_id, productId: product_id } = await params;

  const { error } = await supabaseAdmin
    .from("campaign_event_products")
    .delete()
    .eq("campaign_id", campaign_id)
    .eq("product_id", product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
