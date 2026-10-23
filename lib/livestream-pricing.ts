import { getShippingZone, calculateShipping } from "./shipping";

export const WA_TAX_RATE   = 0.105; // 10.5%
export const LS_TX_FEE_RATE = 0.05;  // 5%

export interface LivestreamPricing {
  itemPrice:   number;
  shipping:    number;
  txFee:       number;
  tax:         number;  // WA only; 0 otherwise
  total:       number;
  isWA:        boolean;
}

export function calculateLivestreamPricing(
  itemPrice: number,
  country: string,
  state: string
): LivestreamPricing {
  const zone       = getShippingZone(country);
  const shipping   = calculateShipping(zone, 1);
  const txFee      = Math.round((itemPrice + shipping) * LS_TX_FEE_RATE * 100) / 100;
  const isWA       = country === "US" && state.trim().toUpperCase() === "WA";
  const tax        = isWA
    ? Math.round((itemPrice + shipping + txFee) * WA_TAX_RATE * 100) / 100
    : 0;
  const total      = Math.round((itemPrice + shipping + txFee + tax) * 100) / 100;
  return { itemPrice, shipping, txFee, tax, total, isWA };
}
