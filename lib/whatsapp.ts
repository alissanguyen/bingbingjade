const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export interface WhatsAppProduct {
  name: string;
  public_id: string;
  slug?: string | null;
}

function buildProductUrl(p: WhatsAppProduct): string {
  const path = p.slug
    ? `/products/${p.slug}-${p.public_id}`
    : `/products/${p.public_id}`;
  return `${SITE_URL}${path}`;
}

export function buildWhatsAppLink(products: WhatsAppProduct[]): string {
  let message: string;

  if (products.length === 0) {
    message = "Hi, I'd like to inquire about your jade pieces.";
  } else if (products.length === 1) {
    const p = products[0];
    message =
      `Hi, I'm interested in this jade piece:\n\n` +
      `${p.name}\n` +
      `Product ID: ${p.public_id}\n\n` +
      `${buildProductUrl(p)}\n\n` +
      `I'd love to learn more about it when you have a moment. Thank you!`;
  } else {
    const list = products.map((p) => p.name).join("\n");
    message =
      `Hi, I'm interested in these jade pieces:\n\n` +
      `${list}\n\n` +
      `Could you provide more details? Thank you!`;
  }

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
