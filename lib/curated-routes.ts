export type CuratedFilter = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  clearance?: boolean;
};

export type CuratedRoute = {
  slug: string;
  label: string;
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  filters: CuratedFilter;
};

export const COLLECTION_FILTERS: Record<string, CuratedRoute> = {
  everyday: {
    slug: "everyday",
    label: "Everyday Jade",
    title: "Everyday Jade",
    eyebrow: "Curated Collection",
    description: "Refined jade pieces chosen for daily wear, quiet polish, and effortless gifting.",
    href: "/collections/everyday",
    filters: { maxPrice: 699 },
  },
  "most-loved": {
    slug: "most-loved",
    label: "Most Loved Pieces",
    title: "Most Loved Pieces",
    eyebrow: "Curated Collection",
    description: "Customer favorites with memorable color, glow, and presence across the collection.",
    href: "/collections/most-loved",
    filters: { minPrice: 700, maxPrice: 3999 },
  },
  "collector-picks": {
    slug: "collector-picks",
    label: "Collector's Picks",
    title: "Collector Picks",
    eyebrow: "Curated Collection",
    description: "Distinctive pieces selected for stronger character, rarity, and collecting appeal.",
    href: "/collections/collector-picks",
    filters: { minPrice: 4000, maxPrice: 9999 },
  },
  "rare-investment": {
    slug: "rare-investment",
    label: "Rare & Investment Jade",
    title: "Rare & Investment Jade",
    eyebrow: "Curated Collection",
    description: "Exceptional jadeite pieces with elevated material quality and long-term significance.",
    href: "/collections/rare-investment",
    filters: { minPrice: 10000 },
  },
  "archive-sale": {
    slug: "archive-sale",
    label: "Clearance & Archive",
    title: "Clearance & Archive Sale",
    eyebrow: "Limited Selection",
    description: "Last-chance pieces and special markdowns from prior edits of the collection.",
    href: "/collections/archive-sale",
    filters: { clearance: true },
  },
};

export const SIZE_FILTERS: Record<string, CuratedRoute> = {
  "below-49mm": {
    slug: "below-49mm",
    label: "Below 49mm",
    title: "Bangles Below 49mm",
    eyebrow: "Bangle Size Edit",
    description: "Petite jade bangles selected for smaller wrists and close, refined fits.",
    href: "/sizes/below-49mm",
    filters: { category: "bangle", maxSize: 48.999999 },
  },
  "50mm-52mm": {
    slug: "50mm-52mm",
    label: "Size 50mm - 52mm",
    title: "50mm - 52mm Bangles",
    eyebrow: "Bangle Size Edit",
    description: "A curated range of smaller jade bangles with graceful everyday proportions.",
    href: "/sizes/50mm-52mm",
    filters: { category: "bangle", minSize: 50, maxSize: 52.999999 },
  },
  "53mm-55mm": {
    slug: "53mm-55mm",
    label: "Size 53mm - 55mm",
    title: "53mm - 55mm Bangles",
    eyebrow: "Bangle Size Edit",
    description: "Balanced jade bangles in one of the most versatile fit ranges.",
    href: "/sizes/53mm-55mm",
    filters: { category: "bangle", minSize: 53, maxSize: 55.999999 },
  },
  "56mm-58mm": {
    slug: "56mm-58mm",
    label: "Size 56mm - 58mm",
    title: "56mm - 58mm Bangles",
    eyebrow: "Bangle Size Edit",
    description: "Elegant mid-to-roomier bangle sizes with a comfortable, wearable profile.",
    href: "/sizes/56mm-58mm",
    filters: { category: "bangle", minSize: 56, maxSize: 58.999999 },
  },
  "59mm-61mm": {
    slug: "59mm-61mm",
    label: "Size 59mm - 61mm",
    title: "59mm - 61mm Bangles",
    eyebrow: "Bangle Size Edit",
    description: "Roomier jade bangles selected for ease, presence, and comfortable movement.",
    href: "/sizes/59mm-61mm",
    filters: { category: "bangle", minSize: 59, maxSize: 61 },
  },
  "above-61mm": {
    slug: "above-61mm",
    label: "Above 61mm",
    title: "Bangles Above 61mm",
    eyebrow: "Bangle Size Edit",
    description: "Larger jade bangles with statement proportions and generous fit.",
    href: "/sizes/above-61mm",
    filters: { category: "bangle", minSize: 61.000001 },
  },
};

export function curatedFilterToSearchParams(filters: CuratedFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.category) params.category = filters.category;
  if (filters.minPrice != null) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice != null) params.maxPrice = String(filters.maxPrice);
  if (filters.minSize != null) params.minSize = String(filters.minSize);
  if (filters.maxSize != null) params.maxSize = String(filters.maxSize);
  if (filters.clearance) params.clearance = "1";
  return params;
}
