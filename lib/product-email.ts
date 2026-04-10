/**
 * Product showcase email builder.
 * Generates a branded HTML email featuring selected products,
 * safe for all major email clients (table-based, inline styles).
 */

const BANNER_IMAGE = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const BANNER_CAPTIONS = [
  ["New Arrivals", "Handpicked for You"],
  ["Fresh Jadeite Finds Have Arrived", ""],
  ["Our Latest Natural Jadeite Pieces", ""],
  ["New In: Rare Finds at BingBing Jade", ""],
];

const DEFAULT_INTRO = "Discover our latest selection of natural jadeite pieces, chosen for their beauty, character, and quiet elegance. Once sold, each piece is gone.";

const CATEGORY_LABELS: Record<string, string> = {
  bracelet: "Bracelets",
  bangle: "Bangles",
  ring: "Rings",
  pendant: "Pendants",
  necklace: "Necklaces",
  set: "Sets",
  earring: "Earrings",
  raw_material: "Raw Material",
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
  const isOnSale = product.status === "on_sale";
  const displayPrice = product.sale_price_usd ?? product.price_display_usd;
  const catLabel = categoryLabel(product.category);

  const priceHtml = displayPrice != null
    ? `<span style="font-size:15px;font-weight:700;color:${isOnSale ? "#d97706" : "#065f46"};">${fmtPrice(displayPrice)}</span>${
        isOnSale && product.price_display_usd != null
          ? ` <span style="font-size:12px;color:#9ca3af;text-decoration:line-through;">${fmtPrice(product.price_display_usd)}</span>`
          : ""
      }`
    : `<span style="font-size:14px;color:#6b7280;">Contact for price</span>`;

  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.name.replace(/"/g, "&quot;")}" width="260" height="220" style="display:block;width:100%;height:220px;object-fit:cover;" />`
    : `<div style="width:100%;height:220px;background:#f0fdf4;text-align:center;line-height:220px;font-size:32px;">&#129704;</div>`;

  return `
    <td width="50%" style="padding:0 6px 14px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:0;overflow:hidden;border-radius:10px 10px 0 0;">
            <a href="${href}" style="display:block;text-decoration:none;">
              ${imageHtml}
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 12px 16px;">
            <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">${catLabel}</p>
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111827;line-height:1.35;">${product.name}</p>
            <p style="margin:0 0 12px;">${priceHtml}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${href}" class="btn-shop" style="display:inline-block;padding:7px 14px;font-size:11px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">Shop This Piece &rarr;</a>
                </td>
              </tr>
            </table>
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

  // Pick a random caption
  const caption = BANNER_CAPTIONS[Math.floor(Math.random() * BANNER_CAPTIONS.length)];
  const captionLine1 = caption[0];
  const captionLine2 = caption[1];

  const introText = intro || DEFAULT_INTRO;

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
    /* Force light-only rendering — prevents Gmail dark mode from inverting banner text */
    :root { color-scheme: light only; }

    /* Banner text: always white/light-green regardless of dark mode */
    .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    .banner-body    { color: rgba(255,255,255,0.85) !important; -webkit-text-fill-color: rgba(255,255,255,0.85) !important; }

    /* Gmail dark mode overrides (data-ogsc / data-ogsb selectors) */
    [data-ogsc] .banner-eyebrow,
    [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading,
    [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    [data-ogsc] .banner-body,
    [data-ogsb] .banner-body    { color: rgba(255,255,255,0.85) !important; -webkit-text-fill-color: rgba(255,255,255,0.85) !important; }

    /* Mobile: tighter cards so "Shop This Piece" fits on one line */
    @media only screen and (max-width: 480px) {
      .card-inner { padding: 10px 10px 14px !important; }
      .btn-shop   { font-size: 10px !important; padding: 6px 12px !important; }
      .card-name  { font-size: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper — no side padding so banner hits full width -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <!-- Email container — wider for desktop impact -->
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:1200px;background:#ffffff;">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:700px;height:300px;">
              <v:fill type="frame" src="${BANNER_IMAGE}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${BANNER_IMAGE}');background-size:cover;background-position:center;min-height:300px;position:relative;background-color:#1a3d35;">
              <!-- Dark overlay table -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(to bottom,rgba(8,24,18,0.60) 0%,rgba(8,24,18,0.80) 100%);padding:60px 40px 56px;text-align:center;">
                    ${captionLine1 ? `<p class="banner-eyebrow" style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">${captionLine1}</font></p>` : ""}
                    ${captionLine2
                      ? `<h1 class="banner-heading" style="margin:0;font-size:32px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;letter-spacing:-0.01em;line-height:1.2;"><font color="#ffffff">${captionLine2}</font></h1>`
                      : `<h1 class="banner-heading" style="margin:0;font-size:32px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;letter-spacing:-0.01em;line-height:1.2;"><font color="#ffffff">BingBing Jade</font></h1>`}
                    <p class="banner-body" style="margin:18px auto 0;max-width:420px;font-size:14px;color:rgba(255,255,255,0.85)!important;-webkit-text-fill-color:rgba(255,255,255,0.85)!important;line-height:1.7;"><font color="#e5e7eb">${introText}</font></p>
                    <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
                      <tr>
                        <td style="background:#ffffff;border-radius:999px;">
                          <a href="${siteUrl}/products" style="display:inline-block;padding:11px 28px;font-size:13px;font-weight:600;color:#1a3d35;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">Browse Full Collection &rarr;</a>
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

        <!-- ═══ SECTION LABEL ═══ -->
        <tr>
          <td style="padding:32px 32px 8px;text-align:center;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;">Latest Pieces</p>
            <h2 style="margin:0;font-size:20px;font-weight:700;color:#111827;">${subject}</h2>
          </td>
        </tr>

        <!-- ═══ PRODUCTS GRID ═══ -->
        <tr>
          <td style="padding:20px 20px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${productRowsHtml}
            </table>
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:8px 32px 0;">
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
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
