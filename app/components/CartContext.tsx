"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CartItem } from "@/types/cart";
import {
  getCart,
  addToCart as addItem,
  removeFromCart as removeItem,
  clearCart as clearAll,
} from "@/lib/cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string, optionId: string | null) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setItems(getCart());
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    const updated = addItem(item);
    setItems(updated);
    setDrawerOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string, optionId: string | null) => {
    const updated = removeItem(productId, optionId);
    setItems(updated);
  }, []);

  const clearCart = useCallback(() => {
    clearAll();
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        addToCart,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
