import { supabaseAdmin } from "@/lib/supabase-admin";

export interface EventPriceEntry {
  campaignEventId: string;
  // Explicit per-product override (applies to all options/variants)
  explicitPrice: number | null;
  // Discount info for computing per-option prices
  discountType: string | null;
  discountValue: number | null;
  // Pre-computed event price using product.price_display_usd as the base
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

  const { data: rows } = await supabaseAdmin
    .from("campaign_event_products")
    .select(`
      product_id, event_price_usd,
      campaign_events!inner (
        id, status, discount_type, discount_value, starts_at, ends_at
      ),
      products!inner (price_display_usd)
    `)
    .in("product_id", productIds);

  const result = new Map<string, EventPriceEntry>();

  for (const row of rows ?? []) {
    const ce = row.campaign_events as unknown as {
      id: string; status: string;
      discount_type: string | null; discount_value: number | null;
      starts_at: string | null; ends_at: string | null;
    };
    const p = row.products as unknown as { price_display_usd: number | null };

    if (!ce || ce.status !== "active") continue;
    if (ce.starts_at && ce.starts_at > nowIso) continue;
    if (ce.ends_at && ce.ends_at < nowIso) continue;

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
