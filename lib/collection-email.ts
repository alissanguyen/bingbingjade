/**
 * Collection drops email builder.
 * Generates a branded HTML email announcing a BingBing exclusive collection.
 * Table-based, inline styles — safe for all major email clients.
 */

import type { EmailProduct } from "./product-email";

export type { EmailProduct };

const FALLBACK_BANNER = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelet", bangle: "Bangle", ring: "Ring", pendant: "Pendant",
  necklace: "Necklace", set: "Set", earring: "Earrings", raw_material: "Raw Material",
};

function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

function fmtPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function productCard(product: EmailProduct, siteUrl: string): string {
  const href = `${siteUrl}/products/${product.slug}`;
  const isOnSale = product.status === "on_sale";
  const displayPrice = product.sale_price_usd ?? product.price_display_usd;
  const catLabel = categoryLabel(product.category);

  const priceHtml = product.show_price && displayPrice != null
    ? `<span style="font-size:20px;font-weight:700;color:${isOnSale ? "#d97706" : "#065f46"};">${fmtPrice(displayPrice)}</span>${
        isOnSale && product.price_display_usd != null
          ? ` <span style="font-size:16px;color:#9ca3af;text-decoration:line-through;">${fmtPrice(product.price_display_usd)}</span>`
          : ""
      }`
    : `<span style="font-size:16px;color:#6b7280;">Contact for price</span>`;

  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name.replace(/"/g, "&quot;")}" style="display:block;width:100%;aspect-ratio:1/1;object-fit:cover;" />`
    : `<div style="width:100%;aspect-ratio:1/1;background:#f0fdf4;text-align:center;font-size:48px;line-height:1;padding:40% 0;">&#129704;</div>`;

  return `
    <td width="50%" style="padding:0 10px 20px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:0;overflow:hidden;border-radius:14px 14px 0 0;">
            <a href="${href}" style="display:block;text-decoration:none;">${imageHtml}</a>
          </td>
        </tr>
        <tr>
          <td class="card-inner" style="padding:20px 20px 26px;">
            <p style="margin:0 0 5px;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">${catLabel}</p>
            <p class="card-name" style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;line-height:1.35;">${product.name}</p>
            <p style="margin:0 0 18px;">${priceHtml}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${href}" class="btn-shop" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">Shop This Piece &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>`;
}

export function buildCollectionDropsHtml(params: {
  collectionName: string;
  collectionSlug: string;
  sceneImageUrls: string[];
  subject: string;
  intro: string;
  products: EmailProduct[];
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  const { collectionName, collectionSlug, sceneImageUrls, subject, intro, products, unsubscribeUrl, siteUrl } = params;

  const bannerImage = sceneImageUrls[0] ?? FALLBACK_BANNER;
  const collectionUrl = `${siteUrl}/collections/${collectionSlug}`;
  const introText = intro || `Discover the ${collectionName} collection — a curated selection of natural jadeite pieces chosen for their beauty and rarity. Each piece is one of a kind.`;

  // Scene gallery: 3-column masonry — distribute images round-robin across columns
  const col1 = sceneImageUrls.filter((_, i) => i % 3 === 0);
  const col2 = sceneImageUrls.filter((_, i) => i % 3 === 1);
  const col3 = sceneImageUrls.filter((_, i) => i % 3 === 2);
  const altText = collectionName.replace(/"/g, "&quot;");

  const colHtml = (urls: string[]) => urls.map((url) => `
            <a href="${collectionUrl}" style="display:block;text-decoration:none;margin-bottom:3px;">
              <img src="${url}" alt="${altText}" style="display:block;width:100%;border-radius:0;" />
            </a>`).join("");

  const sceneGalleryHtml = sceneImageUrls.length > 0
    ? `
        <!-- ═══ SCENE GALLERY ═══ -->
        <tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td width="33%" style="padding:0 1.5px 0 0;vertical-align:top;">${colHtml(col1)}</td>
                <td width="34%" style="padding:0 0.75px;vertical-align:top;">${colHtml(col2)}</td>
                <td width="33%" style="padding:0 0 0 1.5px;vertical-align:top;">${colHtml(col3)}</td>
              </tr>
            </table>
          </td>
        </tr>`
    : "";

  // Product grid rows
  const rows: EmailProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  const productRowsHtml = rows
    .map(
      (row) => `
      <tr>
        ${productCard(row[0], siteUrl)}
        ${row[1] ? productCard(row[1], siteUrl) : `<td width="50%" style="padding:0 6px 14px;"></td>`}
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }

    .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    .banner-body    { color: rgba(255,255,255,0.85) !important; -webkit-text-fill-color: rgba(255,255,255,0.85) !important; }
    .banner-badge   { color: #d1fae5 !important; -webkit-text-fill-color: #d1fae5 !important; }

    [data-ogsc] .banner-eyebrow, [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading, [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    [data-ogsc] .banner-body,    [data-ogsb] .banner-body    { color: rgba(255,255,255,0.85) !important; -webkit-text-fill-color: rgba(255,255,255,0.85) !important; }
    [data-ogsc] .banner-badge,   [data-ogsb] .banner-badge   { color: #d1fae5 !important; -webkit-text-fill-color: #d1fae5 !important; }

    @media only screen and (max-width: 480px) {
      .card-inner { padding: 10px 10px 14px !important; }
      .btn-shop   { font-size: 10px !important; padding: 6px 12px !important; }
      .card-name  { font-size: 12px !important; }
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
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:1200px;height:580px;">
              <v:fill type="frame" src="${bannerImage}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${bannerImage}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:580px;">
                <tr>
                  <td height="580" style="background:linear-gradient(to bottom,rgba(4,16,12,0.72) 0%,rgba(4,16,12,0.30) 60%,rgba(4,16,12,0.60) 100%);padding:100px 80px 96px;text-align:center;vertical-align:middle;">

                    <!-- Exclusive badge -->
                    <p style="margin:0 0 20px;">
                      <span style="display:inline-block;padding:5px 18px;border:1px solid rgba(110,231,183,0.5);border-radius:999px;">
                        <span class="banner-badge" style="font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d1fae5!important;-webkit-text-fill-color:#d1fae5!important;"><font color="#d1fae5">BingBing Exclusive Collection</font></span>
                      </span>
                    </p>

                    <p class="banner-eyebrow" style="margin:0 0 14px;font-size:15px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">Now Available</font></p>

                    <h1 class="banner-heading" style="margin:0;font-size:58px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;letter-spacing:-0.02em;line-height:1.15;"><font color="#ffffff">${collectionName}</font></h1>

                    <p class="banner-body" style="margin:22px auto 0;max-width:620px;font-size:18px;color:rgba(255,255,255,0.85)!important;-webkit-text-fill-color:rgba(255,255,255,0.85)!important;line-height:1.7;"><font color="#e5e7eb">${introText}</font></p>

                    <table cellpadding="0" cellspacing="0" style="margin:40px auto 0;">
                      <tr>
                        <td style="background:#ffffff;border-radius:999px;">
                          <a href="${collectionUrl}" style="display:inline-block;padding:16px 48px;font-size:17px;font-weight:600;color:#1a3d35;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">Shop the Collection &rarr;</a>
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

        ${sceneGalleryHtml}

        <!-- ═══ SECTION LABEL ═══ -->
        <tr>
          <td style="padding:${sceneImageUrls.length > 0 ? "40px" : "52px"} 48px 12px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;">From This Collection</p>
            <h2 style="margin:0;font-size:30px;font-weight:700;color:#111827;">${subject}</h2>
          </td>
        </tr>

        ${products.length > 0 ? `
        <!-- ═══ PRODUCTS GRID ═══ -->
        <tr>
          <td style="padding:28px 22px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productRowsHtml}
            </table>
          </td>
        </tr>` : ""}

        <!-- ═══ COLLECTION CTA ═══ -->
        <tr>
          <td style="padding:8px 48px 48px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${collectionUrl}" style="display:inline-block;padding:14px 44px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">View Full Collection &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 32px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 40px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3d35;">BingBing Jade</p>
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
