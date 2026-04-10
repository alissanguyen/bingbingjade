/**
 * Product showcase email builder.
 * Generates a branded HTML email featuring selected products,
 * safe for all major email clients (table-based, inline styles).
 */

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelets",
  bangle: "Bangles",
  ring: "Rings",
  pendant: "Pendants",
  necklace: "Necklaces",
  set: "Sets",
  custom_order: "Custom Orders",
  other: "Other",
};

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

export interface EmailProduct {
  id: string;
  name: string;
  category: string;
  slug: string;         // full slug-publicId segment
  price_display_usd: number | null;
  sale_price_usd: number | null;
  status: string;
  imageUrl: string | null;
}

function fmtPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function productCard(product: EmailProduct, siteUrl: string): string {
  const href = `${siteUrl}/products/${product.slug}`;
  const isSold = product.status === "sold";
  const isOnSale = product.status === "on_sale";
  const displayPrice = product.sale_price_usd ?? product.price_display_usd;
  const catLabel = categoryLabel(product.category);

  const priceHtml = displayPrice != null
    ? `<span style="font-size:15px;font-weight:700;color:${isSold ? "#9ca3af" : isOnSale ? "#d97706" : "#065f46"};">${fmtPrice(displayPrice)}</span>${
        isOnSale && product.price_display_usd != null
          ? ` <span style="font-size:12px;color:#9ca3af;text-decoration:line-through;">${fmtPrice(product.price_display_usd)}</span>`
          : ""
      }`
    : `<span style="font-size:14px;color:#6b7280;">Contact for price</span>`;

  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name.replace(/"/g, "&quot;")}" width="240" height="240" style="display:block;width:100%;height:200px;object-fit:cover;border-radius:0;" />`
    : `<div style="width:100%;height:200px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:32px;">🪨</div>`;

  return `
    <td width="50%" style="padding:8px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;">
        <tr>
          <td style="padding:0;overflow:hidden;border-radius:10px 10px 0 0;">
            <a href="${href}" style="display:block;text-decoration:none;">
              ${imageHtml}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 14px 16px;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">${catLabel}</p>
            <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#111827;line-height:1.4;">${product.name}</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">${priceHtml}</td>
                ${isSold ? `<td style="text-align:right;"><span style="font-size:11px;font-weight:600;background:#111827;color:#ffffff;padding:2px 8px;border-radius:99px;">Sold</span></td>` : ""}
              </tr>
            </table>
            ${!isSold ? `
            <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${href}" style="display:inline-block;padding:7px 16px;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;">View Piece &rarr;</a>
                </td>
              </tr>
            </table>` : ""}
          </td>
        </tr>
      </table>
    </td>`;
}

export function buildProductShowcaseHtml(params: {
  subject: string;
  intro: string;
  products: EmailProduct[];
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  const { subject, intro, products, unsubscribeUrl, siteUrl } = params;

  // Pair products into rows of 2
  const rows: EmailProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  const productRowsHtml = rows
    .map(
      (row) => `
      <tr>
        ${productCard(row[0], siteUrl)}
        ${row[1] ? productCard(row[1], siteUrl) : `<td width="50%" style="padding:8px;"></td>`}
      </tr>`
    )
    .join("\n");

  const introHtml = intro
    ? intro
        .split("\n\n")
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${p.replace(/\n/g, "<br>")}</p>`)
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#065f46;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;">New Arrivals</p>
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:32px 40px ${introHtml ? "20px" : "8px"};">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">${subject}</h2>
            ${introHtml}
          </td>
        </tr>

        <!-- Products grid -->
        <tr>
          <td style="padding:8px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productRowsHtml}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:8px 40px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#065f46;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Browse Full Collection &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#d1d5db;">
              <a href="${unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
