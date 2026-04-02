import type { CartItem } from "./cart";

export interface BundleRule {
  id: string;
  productId: string;
  name: string;
  requiredVariantIds: string[];
  bundlePrice: number;
}

export interface AppliedBundle {
  rule: BundleRule;
  matchedItems: CartItem[];
  individualTotal: number;
  discount: number;
}
