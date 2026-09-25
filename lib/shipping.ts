export type ShippingZone =
  | "domestic"
  | "canada"
  | "europe"
  | "australia"
  | "brazil"
  | "mexico"
  | "colombia"
  | "southAmerica"
  | "middleEast"
  | "far";

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
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "ZA", name: "South Africa" },
];

const FAR_COUNTRIES = new Set([
  "CN", "HK", "IN", "ID", "JP", "KR", "MY", "PH", "SG", "TW", "TH", "VN", "ZA",
]);

const BRAZIL_COUNTRIES = new Set(["BR"]);
const MEXICO_COUNTRIES = new Set(["MX"]);
const COLOMBIA_COUNTRIES = new Set(["CO"]);
const SOUTH_AMERICA_COUNTRIES = new Set(["AR", "CL", "PE"]);
const MIDDLE_EAST_COUNTRIES = new Set(["SA", "IL", "AE"]);

const EUROPE_COUNTRIES = new Set([
  "GB", "AT", "BE", "DK", "FI", "FR", "DE", "IT", "NL", "NO", "ES", "SE", "CH",
]);

const AUSTRALIA_COUNTRIES = new Set(["AU", "NZ"]);

export function getShippingZone(country: string): ShippingZone {
  if (country === "US") return "domestic";
  if (country === "CA") return "canada";
  if (EUROPE_COUNTRIES.has(country)) return "europe";
  if (AUSTRALIA_COUNTRIES.has(country)) return "australia";
  if (BRAZIL_COUNTRIES.has(country)) return "brazil";
  if (MEXICO_COUNTRIES.has(country)) return "mexico";
  if (COLOMBIA_COUNTRIES.has(country)) return "colombia";
  if (SOUTH_AMERICA_COUNTRIES.has(country)) return "southAmerica";
  if (MIDDLE_EAST_COUNTRIES.has(country)) return "middleEast";
  if (FAR_COUNTRIES.has(country)) return "far";
  return "far"; // fallback for any unlisted country
}

/**
 * Flat shipping fee in whole dollars, regardless of item count.
 * - Domestic (US):            Free ($0)
 * - Canada:                   $15
 * - Europe (UK + EU):         $20
 * - Australia / NZ:           $30
 * - Middle East (SA/IL/AE):   $30
 * - Mexico:                   $35
 * - South America (AR/CL/PE): $45
 * - Colombia:                 $50
 * - Brazil:                   $60
 * - Far (Asia/Pacific, South Africa): $55
 */
export function calculateShipping(zone: ShippingZone, _itemCount: number): number {
  if (zone === "domestic")  return 0;
  if (zone === "canada")    return 15;
  if (zone === "europe")    return 20;
  if (zone === "australia") return 30;
  if (zone === "middleEast") return 30;
  if (zone === "mexico")    return 35;
  if (zone === "southAmerica") return 45;
  if (zone === "colombia")  return 50;
  if (zone === "brazil")    return 60;
  return 55; // far
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

// Manual-capture authorization window per payment method, in days, per Stripe's
// documented hold periods (docs.stripe.com/payments/place-a-hold-on-a-payment-method,
// verified empirically end-to-end for each method in Stripe test mode — see
// capture-payment / release-authorization admin routes). Card uses the online
// card-not-present window; actual card-network holds can vary slightly by brand.
//
// IMPORTANT: this is only ever used to compute a dashboard/UI estimate
// (authorization_expires_at). The live PaymentIntent status from Stripe is
// always the source of truth for whether a capture/release is actually
// possible — never gate a capture/cancel decision on this table alone.
export const MANUAL_CAPTURE_WINDOW_DAYS: Record<"card" | BnplMethod, number> = {
  card: 7,
  klarna: 28,
  afterpay_clearpay: 13,
  affirm: 30,
  zip: 7, // not yet integrated — placeholder if enabled later
};
