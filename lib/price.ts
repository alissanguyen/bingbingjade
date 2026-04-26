/**
 * Price display helpers for high-value items.
 *
 * $10,000–$29,999 → first 2 digits   e.g. $12,345  → "$12,XXX"
 * $30,000+        → first 1 digit    e.g. $34,567  → "$3X,XXX"
 *                                         $125,000  → "$12X,XXX"
 */

export function obfuscatedPrice(price: number): string {
  if (price >= 30_000) {
    const leading = Math.floor(price / 10_000);
    return `$${leading}X,XXX`;
  }
  // $10,000–$29,999: show first 2 digits (thousands place)
  const leading = Math.floor(price / 1_000);
  return `$${leading},XXX`;
}

/** Returns true when a price should be obfuscated and direct purchase blocked. */
export function requiresInquiry(price: number | null | undefined): boolean {
  return price != null && price >= 10_000;
}
