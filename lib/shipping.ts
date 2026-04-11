export type ShippingZone = "domestic" | "canada" | "far";

// Countries available for shipping, with display names
export const ALLOWED_COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong SAR" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "SG", name: "Singapore" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
];

// Asian/Pacific countries use the "far" (higher) shipping rate
const FAR_COUNTRIES = new Set([
  "CN", "HK", "IN", "ID", "JP", "KR", "MY", "PH", "SG", "TW", "TH", "VN",
]);

export function getShippingZone(country: string): ShippingZone {
  if (country === "US") return "domestic";
  if (FAR_COUNTRIES.has(country)) return "far";
  return "canada";
}

/**
 * Shipping fee in whole dollars.
 * - Domestic (US):   $20 base + $10 per additional item
 * - Canada/nearby:   $35 base + $10 per additional item
 * - Far (Asia etc.): $75 first item + $20 per additional item
 */
export function calculateShipping(zone: ShippingZone, itemCount: number): number {
  const n = Math.max(1, itemCount);
  if (zone === "domestic") return 20 + (n - 1) * 10;
  if (zone === "canada") return 35 + (n - 1) * 10;
  return 75 + (n - 1) * 20;
}

/**
 * Stripe transaction fee in cents, rounded up (Math.ceil).
 * Uses gross-up formula so the seller nets the full subtotal after Stripe deducts their fee.
 *
 * Domestic (US):  2.9% + $0.30
 * International:  4.4% + $0.30
 */
export function calculateStripeFee(subtotalCents: number, zone: ShippingZone): number {
  const rate = zone === "domestic" ? 0.029 : 0.044;
  const grossCents = Math.ceil((subtotalCents + 30) / (1 - rate));
  return grossCents - subtotalCents;
}

/**
 * BNPL fee in cents (Math.round).
 * Uses gross-up formula so the seller nets the full subtotal after BNPL provider deducts their fee.
 *
 * BNPL (Klarna / Afterpay / Affirm): 6.0% + $0.30
 * gross = (targetNet + 0.30) / (1 - 0.06)
 */
export function calculateBnplFee(targetNetCents: number): number {
  return Math.round((targetNetCents + 30) / (1 - 0.06)) - targetNetCents;
}

// All BNPL methods we may support — add here when a new provider is enabled
export const BNPL_METHODS = ["klarna", "afterpay_clearpay", "affirm", "zip"] as const;
export type BnplMethod = typeof BNPL_METHODS[number];

// Currently active BNPL methods sent to Stripe.
// zip: disabled — not yet integrated
export const ACTIVE_BNPL_METHODS: BnplMethod[] = ["klarna", "afterpay_clearpay", "affirm"];
