export type ProductCategory = "bracelet" | "bangle" | "ring" | "pendant" | "necklace" | "other";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  images: string[];
  videos: string[];

  color: string[];
  tier: string[];
  size: number;
  size_detailed: (number | null)[] | null;

  description: string | null;
  blemishes: string | null;

  price_display_usd: number | null;
  sale_price_usd: number | null;
  imported_price_vnd: number;

  vendor_id: string;
  created_at: string;
  is_featured: boolean;
  status: "available" | "sold" | "on_sale";
}
