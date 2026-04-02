"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { CartItem } from "@/types/cart";
import type { BundleRule, AppliedBundle } from "@/types/bundle";
import { applyBundlePricing } from "@/lib/bundle";
import { supabase } from "@/lib/supabase";
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
  bundleRules: BundleRule[];
  appliedBundles: AppliedBundle[];
  bundleDiscount: number;
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
  const [bundleRules, setBundleRules] = useState<BundleRule[]>([]);

  useEffect(() => {
    setItems(getCart());
  }, []);

  // Fetch bundle rules whenever the set of product IDs in cart changes
  const productIdsKey = items.map((i) => i.productId).sort().join(",");
  useEffect(() => {
    if (items.length === 0) {
      setBundleRules([]);
      return;
    }
    const productIds = [...new Set(items.map((i) => i.productId))];
    supabase
      .from("bundle_rules")
      .select("id, product_id, name, required_variant_ids, bundle_price")
      .in("product_id", productIds)
      .then(({ data }) => {
        setBundleRules(
          (data ?? []).map((r: { id: string; product_id: string; name: string; required_variant_ids: string[]; bundle_price: number }) => ({
            id: r.id,
            productId: r.product_id,
            name: r.name,
            requiredVariantIds: r.required_variant_ids,
            bundlePrice: r.bundle_price,
          }))
        );
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsKey]);

  const { appliedBundles, totalDiscount: bundleDiscount } = useMemo(
    () => applyBundlePricing(items, bundleRules),
    [items, bundleRules]
  );

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
        bundleRules,
        appliedBundles,
        bundleDiscount,
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
