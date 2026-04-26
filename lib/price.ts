/**
 * Price display helpers.
 *
 * Under $25,000 → show full price.
 * $25,000+      → hide price entirely; surface "Inquire for Pricing" on cards
 *                 and "Available via consultation" on the product page.
 */

/** Returns true when a price should be hidden and direct purchase blocked. */
export function requiresInquiry(price: number | null | undefined): boolean {
  return price != null && price >= 25_000;
}

/** @deprecated No longer used — prices are either shown in full or hidden. */
export function obfuscatedPrice(_price: number): string {
  return "Inquire for Pricing";
}
