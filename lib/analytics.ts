// Augment the global Window type so TypeScript knows about gtag everywhere.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
  }
}

// ── Core event helper ────────────────────────────────────────────────────────

/** Fire a GA4 event. No-ops safely when GA is not loaded or on the server. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

// ── Shop-specific event helpers ──────────────────────────────────────────────

export function trackProductView(params: {
  productId: string;
  productName: string;
  category?: string;
  price?: number;
  origin?: string;
}): void {
  trackEvent("view_product", {
    product_id: params.productId,
    product_name: params.productName,
    category: params.category,
    price: params.price,
    origin: params.origin,
  });
}

export function trackSelectItem(params: {
  productId: string;
  productName: string;
  category?: string;
  price?: number;
}): void {
  trackEvent("view_item", {
    currency: "USD",
    value: params.price ?? 0,
    items: [
      {
        item_id: params.productId,
        item_name: params.productName,
        item_category: params.category,
        price: params.price,
        quantity: 1,
      },
    ],
  });
}

export function trackPurchase(params: {
  orderId?: string;
  value: number;
  currency?: string;
  items: {
    itemId: string;
    itemName: string;
    price: number;
    quantity?: number;
  }[];
}): void {
  trackEvent("purchase", {
    transaction_id: params.orderId,
    value: params.value,
    currency: params.currency ?? "USD",
    items: params.items.map((i) => ({
      item_id: i.itemId,
      item_name: i.itemName,
      price: i.price,
      quantity: i.quantity ?? 1,
    })),
  });
}

export function trackContactClick(channel: "whatsapp" | "instagram" | "email" | string): void {
  trackEvent("click_contact", { channel });
}

export function trackWhatsAppClick(productName?: string): void {
  trackEvent("click_whatsapp", { product_name: productName });
}

export function trackInstagramClick(): void {
  trackEvent("click_instagram");
}

export function trackBeginCheckout(params: {
  value?: number;
  currency?: string;
  itemCount?: number;
}): void {
  trackEvent("begin_checkout", {
    value: params.value,
    currency: params.currency ?? "USD",
    num_items: params.itemCount,
  });
}

export function trackSearch(searchTerm: string): void {
  trackEvent("search", { search_term: searchTerm });
}

export function trackSizeGuideView(): void {
  trackEvent("view_size_guide");
}

// Satisfy the module requirement for the global augmentation to be picked up.
export {};
