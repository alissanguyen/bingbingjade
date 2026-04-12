// Augment the global Window type so TypeScript knows about gtag everywhere.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    clarity?: (...args: unknown[]) => void;
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
  trackEvent("product_view", {
    product_id: params.productId,
    product_name: params.productName,
    category: params.category,
    price: params.price,
    origin: params.origin,
  });
}

export function trackContactClick(channel: "whatsapp" | "instagram" | "email" | string): void {
  trackEvent("contact_click", { channel });
}

export function trackWhatsAppClick(productName?: string): void {
  trackEvent("whatsapp_click", { product_name: productName });
}

export function trackInstagramClick(): void {
  trackEvent("instagram_click");
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
  trackEvent("size_guide_view");
}

// Satisfy the module requirement for the global augmentation to be picked up.
export {};
