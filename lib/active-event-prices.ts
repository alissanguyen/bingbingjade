import { supabaseAdmin } from "@/lib/supabase-admin";

export interface EventPriceEntry {
  campaignEventId: string;
  explicitPrice: number | null;
  discountType: string | null;
  discountValue: number | null;
  computedBasePrice: number;
}

/**
 * Returns the best (lowest) active campaign event price for each requested product.
 * Uses supabaseAdmin — call only from server components or API routes.
 */
export async function getActiveEventPrices(
  productIds: string[]
): Promise<Map<string, EventPriceEntry>> {
  if (productIds.length === 0) return new Map();

  const nowIso = new Date().toISOString();

  // Step 1: fetch currently active campaigns (status + date range filtered in SQL)
  const { data: activeCampaigns, error: campaignError } = await supabaseAdmin
    .from("campaign_events")
    .select("id, discount_type, discount_value")
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  if (campaignError) {
    console.error("[getActiveEventPrices] campaign_events query error:", campaignError.message);
    return new Map();
  }
  if (!activeCampaigns || activeCampaigns.length === 0) return new Map();

  const campaignIds = activeCampaigns.map((c) => c.id);
  const campaignMap = new Map(activeCampaigns.map((c) => [c.id, c]));

  // Step 2: fetch campaign_event_products for the requested products in active campaigns
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("campaign_event_products")
    .select(`
      product_id, event_price_usd, campaign_id,
      products!inner (price_display_usd)
    `)
    .in("product_id", productIds)
    .in("campaign_id", campaignIds);

  if (rowsError) {
    console.error("[getActiveEventPrices] campaign_event_products query error:", rowsError.message);
    return new Map();
  }

  const result = new Map<string, EventPriceEntry>();

  for (const row of rows ?? []) {
    const ce = campaignMap.get(row.campaign_id as string);
    if (!ce) continue;

    const p = row.products as unknown as { price_display_usd: number | null };
    const base = p.price_display_usd;
    const explicitPrice = row.event_price_usd != null ? Number(row.event_price_usd) : null;

    let computedBasePrice: number | null = null;
    if (explicitPrice != null) {
      computedBasePrice = explicitPrice;
    } else if (ce.discount_type === "percent" && ce.discount_value != null && base != null) {
      computedBasePrice = Math.max(0, base * (1 - ce.discount_value / 100));
    } else if (ce.discount_type === "fixed" && ce.discount_value != null && base != null) {
      computedBasePrice = Math.max(0, base - ce.discount_value);
    }

    if (computedBasePrice == null || computedBasePrice <= 0) continue;

    const productId = row.product_id as string;
    const existing = result.get(productId);
    if (!existing || computedBasePrice < existing.computedBasePrice) {
      result.set(productId, {
        campaignEventId: ce.id,
        explicitPrice,
        discountType: ce.discount_type,
        discountValue: ce.discount_value,
        computedBasePrice,
      });
    }
  }

  return result;
}
