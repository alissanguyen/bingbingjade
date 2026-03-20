export interface CartItem {
  productId: string;
  productPublicId: string;
  productName: string;
  productSlug: string | null;
  optionId: string | null;
  optionLabel: string | null;
  price: number;
  thumbnail: string | null;
}
