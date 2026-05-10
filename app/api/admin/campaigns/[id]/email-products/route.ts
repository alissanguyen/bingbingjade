import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveFirstImageUrl } from "@/lib/storage";
import { productSlug } from "@/lib/slug";

// GET /api/admin/campaigns/[id]/email-products
// Returns featured products for a campaign with event pricing resolved.
// Uses is_featured_for_email=true first; falls back to first 6 by sort_order.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("campaign_events")
    .select("id, discount_type, discount_value")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data: rows } = await supabaseAdmin
    .from("campaign_event_products")
    .select(`
      event_price_usd, sort_order, is_featured_for_email,
      products!inner (id, name, category, slug, public_id, show_price, price_display_usd, sale_price_usd, status, images)
    `)
    .eq("campaign_id", id)
    .order("is_featured_for_email", { ascending: false })
    .order("sort_order")
    .limit(6);

  if (!rows || rows.length === 0) return NextResponse.json({ products: [] });

  type ProductRow = {
    id: string; name: string; category: string; slug: string; public_id: string;
    show_price: boolean; price_display_usd: number | null; sale_price_usd: number | null;
    status: string; images: string[];
  };

  const products = await Promise.all(
    rows.map(async (row) => {
      const p = row.products as unknown as ProductRow;

      let eventPrice: number | null = null;
      if (row.event_price_usd != null) {
        eventPrice = Number(row.event_price_usd);
      } else if (campaign.discount_type === "percent" && campaign.discount_value != null && p.price_display_usd != null) {
        eventPrice = p.price_display_usd * (1 - campaign.discount_value / 100);
      } else if (campaign.discount_type === "fixed" && campaign.discount_value != null && p.price_display_usd != null) {
        eventPrice = Math.max(0, p.price_display_usd - campaign.discount_value);
      }

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        slug: productSlug(p),
        show_price: p.show_price ?? false,
        price_display_usd: p.price_display_usd,
        sale_price_usd: p.sale_price_usd,
        event_price_usd: eventPrice,
        status: p.status,
        imageUrl: await resolveFirstImageUrl(p.images ?? []),
        is_featured_for_email: row.is_featured_for_email,
      };
    })
  );

  return NextResponse.json({ products });
}
