/**
 * Price display helpers for high-value items.
 *
 * Above $20,000 we obfuscate the exact price to encourage direct inquiry:
 *   $20,000–$99,999  → first digit only   e.g. $25,000  → "$2X,XXX"
 *   $100,000+        → first two digits   e.g. $125,000 → "$12X,XXX"
 *
 * Math.floor(price / 10_000) naturally yields 1 digit for the $20K–$99K range
 * and 2+ digits for $100K+, so a single formula covers both rules.
 */

export function obfuscatedPrice(price: number): string {
  const leading = Math.floor(price / 10_000);
  return `$${leading}X,XXX`;
}

/** Returns true when a price should be hidden and direct purchase blocked. */
export function requiresInquiry(price: number | null | undefined): boolean {
  return price != null && price >= 20_000;
}
