import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/admin/campaigns/[id] — campaign with its products
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [{ data: campaign, error }, { data: products }] = await Promise.all([
    supabaseAdmin.from("campaign_events").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("campaign_event_products")
      .select(`
        id, event_price_usd, sort_order, is_featured_for_email, created_at,
        products (id, name, slug, public_id, category, price_display_usd, sale_price_usd, status, images)
      `)
      .eq("campaign_id", id)
      .order("sort_order")
      .order("created_at"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ ...campaign, products: products ?? [] });
}

// PATCH /api/admin/campaigns/[id] — update campaign metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.slug !== undefined) patch.slug = String(body.slug).trim();
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.banner_message !== undefined) patch.banner_message = body.banner_message || null;
  if (body.starts_at !== undefined) patch.starts_at = body.starts_at || null;
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at || null;
  if (body.status !== undefined) patch.status = body.status;
  if (body.discount_type !== undefined) patch.discount_type = body.discount_type || null;
  if (body.discount_value !== undefined) patch.discount_value = body.discount_value ?? null;
  if (body.coupon_code !== undefined) {
    patch.coupon_code = body.coupon_code
      ? String(body.coupon_code).trim().toUpperCase()
      : null;
  }
  if (body.allow_coupon_stack !== undefined) patch.allow_coupon_stack = Boolean(body.allow_coupon_stack);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("campaign_events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/campaigns/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin.from("campaign_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
