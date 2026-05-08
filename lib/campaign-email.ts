/**
 * Campaign email HTML builder.
 * Full-width hero banner with dark overlay — matches New Drops email style.
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

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

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

  const discountBlock = discountCode
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
    /* Force light-only rendering */
    :root { color-scheme: light only; }

    /* Hero text always white regardless of dark mode */
    .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    .banner-body    { color: rgba(255,255,255,0.88) !important; -webkit-text-fill-color: rgba(255,255,255,0.88) !important; }
    .banner-urgency { color: #fde68a !important; -webkit-text-fill-color: #fde68a !important; }

    /* Gmail dark mode overrides */
    [data-ogsc] .banner-eyebrow,
    [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading,
    [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    [data-ogsc] .banner-body,
    [data-ogsb] .banner-body    { color: rgba(255,255,255,0.88) !important; -webkit-text-fill-color: rgba(255,255,255,0.88) !important; }
    [data-ogsc] .banner-urgency,
    [data-ogsb] .banner-urgency { color: #fde68a !important; -webkit-text-fill-color: #fde68a !important; }

    /* Mobile */
    @media only screen and (max-width: 480px) {
      .banner-heading { font-size: 30px !important; }
      .banner-body    { font-size: 15px !important; }
      .card-inner     { padding: 10px 10px 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:1200px;background:#ffffff;">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:1200px;height:560px;">
              <v:fill type="frame" src="${BANNER_IMAGE}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${BANNER_IMAGE}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:560px;">
                <tr>
                  <td height="560" style="background:linear-gradient(to bottom,rgba(6,20,14,0.72) 0%,rgba(6,20,14,0.52) 60%,rgba(6,20,14,0.68) 100%);padding:100px 80px 96px;text-align:center;vertical-align:middle;">

                    <!-- Eyebrow / brand -->
                    <p class="banner-eyebrow" style="margin:0 0 16px;font-size:14px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;">
                      <font color="#6ee7b7">BingBing Jade</font>
                    </p>

                    <!-- Headline -->
                    <h1 class="banner-heading" style="margin:0 0 28px;font-size:48px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;letter-spacing:-0.02em;line-height:1.15;font-family:Georgia,'Times New Roman',serif;">
                      <font color="#ffffff">${headline}</font>
                    </h1>

                    <!-- Intro -->
                    <p class="banner-body" style="margin:0 auto 32px;max-width:640px;font-size:17px;color:rgba(255,255,255,0.88)!important;-webkit-text-fill-color:rgba(255,255,255,0.88)!important;line-height:1.75;">
                      <font color="#e5e7eb">${intro}</font>
                    </p>

                    ${
                      urgencyLine
                        ? `<!-- Urgency line -->
                    <p class="banner-urgency" style="margin:0 auto 28px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#fde68a!important;-webkit-text-fill-color:#fde68a!important;">
                      <font color="#fde68a">${urgencyLine}</font>
                    </p>`
                        : ""
                    }

                    <!-- CTA button -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="background:#ffffff;border-radius:999px;">
                          <a href="${ctaHref}" style="display:inline-block;padding:16px 52px;font-size:16px;font-weight:600;color:#1a3d35;text-decoration:none;letter-spacing:0.03em;white-space:nowrap;">
                            ${ctaText} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </div>
            <!--[if mso]>
              </v:textbox>
            </v:rect>
            <![endif]-->
          </td>
        </tr>

        ${discountBlock ? `
        <!-- ═══ DISCOUNT CODE ═══ -->
        <tr>
          <td style="padding:48px 48px 0;">
            ${discountBlock}
          </td>
        </tr>` : ""}

        ${
          hasProducts
            ? `
        <!-- ═══ PRODUCTS HEADER ═══ -->
        <tr>
          <td style="padding:52px 48px 12px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;">Featured Pieces</p>
            <h2 style="margin:0;font-size:28px;font-weight:700;color:#111827;">Selected for This Campaign</h2>
          </td>
        </tr>

        <!-- ═══ PRODUCTS GRID ═══ -->
        <tr>
          <td style="padding:28px 32px 12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productRowsHtml}
            </table>
          </td>
        </tr>`
            : ""
        }

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:${hasProducts || discountCode ? "8px" : "48px"} 32px 0;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 40px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3d35;font-family:Georgia,'Times New Roman',serif;">BingBing Jade</p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:10px 0 0;font-size:10px;color:#d1d5db;">
              <a href="${unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#9ca3af;">This is a no-reply address. For inquiries, contact <a href="mailto:contact@bingbingjade.com" style="color:#9ca3af;text-decoration:none;">contact@bingbingjade.com</a>.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
