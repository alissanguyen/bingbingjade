import type { CartItem } from "@/types/cart";

const KEY = "bbj_cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const exists = cart.some(
    (c) => c.productId === item.productId && c.optionId === item.optionId
  );
  if (exists) return cart;
  const updated = [...cart, item];
  saveCart(updated);
  return updated;
}

export function removeFromCart(productId: string, optionId: string | null): CartItem[] {
  const updated = getCart().filter(
    (c) => !(c.productId === productId && c.optionId === optionId)
  );
  saveCart(updated);
  return updated;
}

export function clearCart(): void {
  localStorage.removeItem(KEY);
}
