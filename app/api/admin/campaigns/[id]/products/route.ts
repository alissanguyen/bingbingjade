import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/campaigns/[id]/products — add a product to the campaign
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaign_id } = await params;

  let body: { product_id?: string; event_price_usd?: number | null; is_featured_for_email?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.product_id) return NextResponse.json({ error: "product_id is required." }, { status: 400 });

  // Get current max sort_order
  const { data: existing } = await supabaseAdmin
    .from("campaign_event_products")
    .select("sort_order")
    .eq("campaign_id", campaign_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSort = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data, error } = await supabaseAdmin
    .from("campaign_event_products")
    .insert({
      campaign_id,
      product_id: body.product_id,
      event_price_usd: body.event_price_usd ?? null,
      is_featured_for_email: body.is_featured_for_email ?? false,
      sort_order: nextSort,
    })
    .select(`
      id, event_price_usd, sort_order, is_featured_for_email, created_at,
      products (id, name, slug, public_id, category, price_display_usd, sale_price_usd, status, images)
    `)
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Product already in this campaign." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
