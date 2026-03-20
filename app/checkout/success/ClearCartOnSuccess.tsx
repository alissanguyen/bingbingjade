"use client";

import { useEffect } from "react";
import { useCart } from "@/app/components/CartContext";

export function ClearCartOnSuccess() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
