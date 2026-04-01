export const PRODUCTCARD_CATEGORIES = [
  { value: "bracelet",     label: "Bracelets" },
  { value: "bangle",       label: "Bangles" },
  { value: "ring",         label: "Rings" },
  { value: "pendant",      label: "Pendants" },
  { value: "necklace",     label: "Necklaces" },
  { value: "set",          label: "Sets" },
  { value: "custom_order", label: "Custom Orders" },
  { value: "other",        label: "Other" },
];

export function getCategoryLabel(value: string): string {
  return PRODUCTCARD_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
