export type FulfillmentType = "available_now" | "sourced_for_you";

export interface CartItem {
  productId: string;
  productPublicId: string;
  productName: string;
  productSlug: string | null;
  optionId: string | null;
  optionLabel: string | null;
  price: number;
  originalPrice: number | null;
  thumbnail: string | null;
  quickShip?: boolean;
  fulfillmentType?: FulfillmentType;
}
