/**
 * Campaign email HTML builder.
 * Produces a dark-header, clean-body luxury email for seasonal/promotional campaigns.
 * Table-based layout, inline styles — safe for all major email clients.
 */

import type { EmailProduct } from "@/lib/product-email";

export interface CampaignEmailParams {
  subject: string;
  headline: string;
  intro: string;
  urgencyLine?: string;
  ctaText: string;
  ctaLink: string;
  discountCode?: string;
  expiryDate?: string;
  products?: EmailProduct[];
  unsubscribeUrl: string;
  siteUrl: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelet",
  bangle: "Bangle",
  ring: "Ring",
  pendant: "Pendant",
  necklace: "Necklace",
  set: "Set",
  earring: "Earrings",
  raw_material: "Raw Material",
};

function resolveCtaHref(link: string, siteUrl: string): string {
  if (link.startsWith("http://") || link.startsWith("https://")) return link;
  return `${siteUrl}${link.startsWith("/") ? "" : "/"}${link}`;
}

function fmtPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function campaignProductCard(product: EmailProduct, siteUrl: string): string {
  const href = `${siteUrl}/products/${product.slug}`;
  const isOnSale = product.status === "on_sale";
  const displayPrice = product.sale_price_usd ?? product.price_display_usd;
  const catLabel = CATEGORY_LABELS[product.category] ?? product.category;

  const priceHtml =
    product.show_price && displayPrice != null
      ? `<span style="font-size:18px;font-weight:700;color:${isOnSale ? "#b45309" : "#065f46"};">${fmtPrice(displayPrice)}</span>${
          isOnSale && product.price_display_usd != null
            ? ` <span style="font-size:14px;color:#9ca3af;text-decoration:line-through;">${fmtPrice(product.price_display_usd)}</span>`
            : ""
        }`
      : `<span style="font-size:13px;color:#6b7280;font-style:italic;">Contact for price</span>`;

  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name.replace(/"/g, "&quot;")}" width="100%" style="display:block;width:100%;aspect-ratio:1/1;object-fit:cover;" />`
    : `<div style="width:100%;padding-bottom:100%;background:#f0fdf4;position:relative;"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;">&#129704;</div></div>`;

  return `
    <td width="50%" style="padding:0 8px 20px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:0;overflow:hidden;">
            <a href="${href}" style="display:block;text-decoration:none;">${imageHtml}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 16px 20px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">${catLabel}</p>
            <p style="margin:0 0 10px;font-size:16px;font-weight:600;color:#111827;line-height:1.35;">${product.name}</p>
            <p style="margin:0 0 14px;">${priceHtml}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${href}" style="display:inline-block;padding:9px 18px;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.03em;white-space:nowrap;">View Piece &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>`;
}

export function buildCampaignEmailHtml(params: CampaignEmailParams): string {
  const { subject, headline, intro, urgencyLine, ctaText, ctaLink, discountCode, expiryDate, products, unsubscribeUrl, siteUrl } = params;

  const ctaHref = resolveCtaHref(ctaLink, siteUrl);
  const hasProducts = Array.isArray(products) && products.length > 0;

  // Product grid — pairs of 2 per row
  let productRowsHtml = "";
  if (hasProducts) {
    const rows: EmailProduct[][] = [];
    for (let i = 0; i < products!.length; i += 2) rows.push(products!.slice(i, i + 2));
    productRowsHtml = rows
      .map(
        (row) => `
        <tr>
          ${campaignProductCard(row[0], siteUrl)}
          ${row[1] ? campaignProductCard(row[1], siteUrl) : `<td width="50%" style="padding:0 8px 20px;"></td>`}
        </tr>`
      )
      .join("\n");
  }

  const discountBlock =
    discountCode
      ? `
        <!-- Discount code box -->
        <tr>
          <td style="padding:0 40px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #059669;border-radius:10px;background:#f0fdf4;">
              <tr>
                <td style="padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#047857;">Your Code</p>
                  <p style="margin:0 0 8px;font-size:26px;font-weight:700;letter-spacing:0.12em;font-family:ui-monospace,'Courier New',monospace;color:#064e3b;">${discountCode}</p>
                  ${expiryDate ? `<p style="margin:0;font-size:11px;color:#6b7280;font-style:italic;">Valid through ${expiryDate}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    :root { color-scheme: light only; }
    .campaign-headline { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
    @media only screen and (max-width: 480px) {
      .campaign-headline { font-size: 28px !important; }
      .campaign-intro    { font-size: 15px !important; }
      .campaign-padding  { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f0f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f0;">
    <tr><td align="center" style="padding:32px 16px;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:#0a1f19;padding:0;">
            <!-- Gold accent line -->
            <div style="height:2px;background:linear-gradient(to right,#c9a84c,#e8d08a,#c9a84c);"></div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:22px 40px;text-align:center;">
                  <a href="${siteUrl}" style="text-decoration:none;">
                    <span style="font-size:22px;font-weight:700;letter-spacing:0.06em;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">BingBing Jade</span>
                  </a>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:rgba(201,168,76,0.25);margin:0 40px;"></div>
          </td>
        </tr>

        <!-- ═══ HERO ═══ -->
        <tr>
          <td class="campaign-padding" style="padding:52px 40px 36px;text-align:center;">
            <h1 class="campaign-headline" style="margin:0 0 20px;font-size:34px;font-weight:700;color:#111827;letter-spacing:-0.02em;line-height:1.2;font-family:Georgia,'Times New Roman',serif;">
              ${headline}
            </h1>
            <!-- Divider -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="width:24px;height:1px;background:#c9a84c;"></td>
                <td style="width:6px;"></td>
                <td style="width:6px;height:6px;background:#c9a84c;border-radius:50%;"></td>
                <td style="width:6px;"></td>
                <td style="width:24px;height:1px;background:#c9a84c;"></td>
              </tr>
            </table>
            <p class="campaign-intro" style="margin:0 auto;max-width:480px;font-size:16px;color:#4b5563;line-height:1.75;">
              ${intro}
            </p>
            ${
              urgencyLine
                ? `<p style="margin:20px 0 0;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#b45309;font-style:italic;">${urgencyLine}</p>`
                : ""
            }
          </td>
        </tr>

        ${discountBlock}

        <!-- ═══ MAIN CTA ═══ -->
        <tr>
          <td style="padding:4px 40px ${hasProducts ? "44px" : "52px"};text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${ctaHref}" style="display:inline-block;padding:15px 44px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.04em;white-space:nowrap;">
                    ${ctaText} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${
          hasProducts
            ? `
        <!-- ═══ PRODUCTS ═══ -->
        <tr>
          <td style="padding:0 40px 8px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 0;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;text-align:center;">Featured Pieces</p>
            <h2 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;text-align:center;">Selected for This Campaign</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productRowsHtml}
            </table>
          </td>
        </tr>`
            : ""
        }

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 40px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="background:#0a1f19;padding:28px 40px;text-align:center;border-radius:0 0 16px 16px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#ffffff;letter-spacing:0.05em;font-family:Georgia,'Times New Roman',serif;">BingBing Jade</p>
            <p style="margin:0 0 10px;font-size:11px;color:rgba(255,255,255,0.45);">
              &copy; ${new Date().getFullYear()} &middot;
              <a href="${siteUrl}" style="color:rgba(255,255,255,0.45);text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:0 0 4px;font-size:10px;color:rgba(255,255,255,0.3);">
              <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.3);text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.25);">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:rgba(255,255,255,0.25);text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`;
}
