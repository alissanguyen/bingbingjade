export const PRODUCTCARD_CATEGORIES = [
  { value: "bracelet",     label: "Bracelet" },
  { value: "bangle",       label: "Bangle" },
  { value: "ring",         label: "Ring" },
  { value: "pendant",      label: "Pendant" },
  { value: "necklace",     label: "Necklace" },
  { value: "set",          label: "Set" },
  { value: "earring",      label: "Earrings" },
  { value: "raw_material", label: "Raw Material" },
];

export function getCategoryLabel(value: string): string {
  return PRODUCTCARD_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
