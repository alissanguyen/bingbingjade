import type { CartItem } from "@/types/cart";
import type { BundleRule, AppliedBundle } from "@/types/bundle";

export function applyBundlePricing(
  cartItems: CartItem[],
  bundleRules: BundleRule[]
): { appliedBundles: AppliedBundle[]; totalDiscount: number } {
  const usedOptionIds = new Set<string>();
  const appliedBundles: AppliedBundle[] = [];

  // Sort by highest savings first to maximise customer benefit
  const sorted = [...bundleRules].sort((a, b) => {
    const savings = (rule: BundleRule) => {
      const total = rule.requiredVariantIds.reduce((s, id) => {
        const item = cartItems.find((c) => c.optionId === id);
        return s + (item?.price ?? 0);
      }, 0);
      return total - rule.bundlePrice;
    };
    return savings(b) - savings(a);
  });

  for (const rule of sorted) {
    const matchedItems = rule.requiredVariantIds
      .map((id) => cartItems.find((c) => c.optionId === id && !usedOptionIds.has(id)))
      .filter((item): item is CartItem => item != null);

    if (matchedItems.length !== rule.requiredVariantIds.length) continue;

    const individualTotal = matchedItems.reduce((s, c) => s + c.price, 0);
    const discount = Math.round((individualTotal - rule.bundlePrice) * 100) / 100;

    if (discount <= 0) continue; // bundle price not cheaper

    for (const id of rule.requiredVariantIds) {
      usedOptionIds.add(id);
    }

    appliedBundles.push({ rule, matchedItems, individualTotal, discount });
  }

  const totalDiscount =
    Math.round(appliedBundles.reduce((s, b) => s + b.discount, 0) * 100) / 100;

  return { appliedBundles, totalDiscount };
}
