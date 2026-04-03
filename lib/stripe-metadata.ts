/**
 * Stripe session metadata helpers.
 *
 * Stripe limits each metadata value to 500 characters. We store cart items
 * as compact JSON chunks (`items_0`, `items_1`, …) to stay comfortably under
 * that limit at any cart size.
 *
 * Compact item shape: { p: productId, o?: optionId, $: priceUsd }
 * Max 4 items per key → worst case ~391 chars (UUID + UUID + price) per key.
 *
 * The decode function also handles the legacy `items` key (full objects) for
 * backward-compatibility with sessions created before this format.
 */

export interface MetaItem {
  productId: string;
  optionId: string | null;
  price: number;
  fulfillmentType?: "available_now" | "sourced_for_you";
}

// Discount fields stored alongside item chunks in Stripe session metadata.
export interface DiscountMeta {
  source: string;           // 'welcome' | 'referral' | 'campaign' | 'store_credit'
  amountCents: number;
  subtotalBeforeCents: number;
  code?: string;            // referral or campaign code used
  referrerCustomerId?: string;
  campaignId?: string;
}

export function encodeDiscountMeta(d: DiscountMeta): Record<string, string> {
  // All values are short and will fit in one 500-char metadata slot.
  return { disc: JSON.stringify(d) };
}

export function decodeDiscountMeta(
  metadata: Record<string, string> | null | undefined
): DiscountMeta | null {
  if (!metadata?.disc) return null;
  try {
    return JSON.parse(metadata.disc) as DiscountMeta;
  } catch {
    return null;
  }
}

interface CompactItem {
  p: string;
  o?: string | null;
  $: number;
  f?: "a" | "s"; // fulfillmentType: 'a'=available_now, 's'=sourced_for_you
}

export const METADATA_CHUNK_SIZE = 4;

/** Encode cart items into Stripe-safe metadata keys. */
export function encodeCheckoutItems(items: MetaItem[]): Record<string, string> {
  const compact: CompactItem[] = items.map((i) => ({
    p: i.productId,
    ...(i.optionId ? { o: i.optionId } : {}),
    $: i.price,
    ...(i.fulfillmentType === "available_now" ? { f: "a" as const } : i.fulfillmentType === "sourced_for_you" ? { f: "s" as const } : {}),
  }));

  const metadata: Record<string, string> = {};
  for (let idx = 0; idx < compact.length; idx += METADATA_CHUNK_SIZE) {
    metadata[`items_${Math.floor(idx / METADATA_CHUNK_SIZE)}`] = JSON.stringify(
      compact.slice(idx, idx + METADATA_CHUNK_SIZE)
    );
  }
  return metadata;
}

/** Decode items from Stripe session metadata. Handles both formats. */
export function decodeCheckoutItems(
  metadata: Record<string, string> | null | undefined
): MetaItem[] {
  if (!metadata) return [];

  // New compact format: items_0, items_1, …
  if ("items_0" in metadata) {
    const result: MetaItem[] = [];
    let idx = 0;
    while (`items_${idx}` in metadata) {
      const chunk: CompactItem[] = JSON.parse(metadata[`items_${idx}`]);
      for (const c of chunk) {
        result.push({
          productId: c.p,
          optionId: c.o ?? null,
          price: c.$,
          fulfillmentType: c.f === "a" ? "available_now" : "sourced_for_you",
        });
      }
      idx++;
    }
    return result;
  }

  // Legacy format: full objects under a single "items" key
  if ("items" in metadata) {
    const legacy = JSON.parse(metadata.items);
    return legacy.map(
      (i: { productId: string; optionId?: string | null; price: number }) => ({
        productId: i.productId,
        optionId: i.optionId ?? null,
        price: i.price,
        fulfillmentType: "sourced_for_you" as const, // legacy sessions default to sourced
      })
    );
  }

  return [];
}
