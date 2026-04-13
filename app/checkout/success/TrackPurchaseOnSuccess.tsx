"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics";

type Item = {
  itemId: string;
  itemName: string;
  price: number;
  quantity?: number;
};

type Props = {
  orderId?: string;
  value: number;
  items: Item[];
};

export function TrackPurchaseOnSuccess({ orderId, value, items }: Props) {
  useEffect(() => {
    if (!value || items.length === 0) return;
    trackPurchase({ orderId, value, currency: "USD", items });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
