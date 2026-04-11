/**
 * Email HTML builders for custom admin email campaigns.
 * All templates use table-based, inline-style HTML safe for major email clients.
 */

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bingbingjade.com").replace(/\/$/, "");
}

const YEAR = new Date().getFullYear();

function brandedWrapper(contentHtml: string, siteUrl: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `<p style="margin:6px 0 0;font-size:10px;color:#d1d5db;"><a href="${unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#065f46;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
          </td>
        </tr>
        <tr><td style="padding:36px 40px 32px;">${contentHtml}</td></tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${YEAR} BingBing Jade &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            ${footer}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function para(text: string, style = ""): string {
  return `<p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.7;${style}">${text}</p>`;
}

function heading(text: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#065f46;">${text}</p>`;
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
    <tr><td style="background:#065f46;border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label} &rarr;</a>
    </td></tr>
  </table>`;
}

// ── Order Delay ───────────────────────────────────────────────────────────────

const DELAY_BANNER = "https://images.unsplash.com/photo-1705931396849-93822983c1dc?q=80&w=1624&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export function buildOrderDelayHtml(params: {
  customerName: string | null;
  orderNumber?: string | null;
  customMessage?: string;
}): string {
  const siteUrl = getSiteUrl();
  const firstName = params.customerName?.split(" ")[0] ?? "Valued customer";

  const bodyParas = params.customMessage
    ? params.customMessage
        .split("\n\n")
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.8;">${p.replace(/\n/g, "<br>")}</p>`)
        .join("")
    : `
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.8;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.8;">We wanted to reach out personally regarding your recent order with us.</p>
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.8;">While your piece is making its way to you, we have encountered a slight delay in transit. Please know that every order we ship receives the same care and attention — and yours is no exception.</p>
        <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.8;">We are actively working to ensure your piece arrives as smoothly and as soon as possible. You need not take any action — we will continue to monitor your shipment closely.</p>
        <p style="margin:0 0 32px;font-size:16px;color:#374151;line-height:1.8;">Thank you for your patience and for the trust you have placed in BingBing Jade. We truly appreciate it.</p>
        <p style="margin:0 0 8px;font-size:15px;color:#6b7280;line-height:1.6;">Warm regards,</p>
        <p style="margin:0 0 36px;font-size:16px;font-weight:600;color:#111827;">The BingBing Jade Team</p>
      `;

  const orderTag = params.orderNumber
    ? `<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Order</p>
       <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">#${params.orderNumber}</p>`
    : "";

  const trackingBtn = params.orderNumber
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="background:#059669;border-radius:999px;">
            <a href="${siteUrl}/orders/${params.orderNumber}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Track My Order &rarr;</a>
          </td>
        </tr>
      </table>`
    : "";

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
    [data-ogsc] .banner-eyebrow, [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading, [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:340px;">
              <v:fill type="frame" src="${DELAY_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${DELAY_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:340px;">
                <tr>
                  <td height="340" style="background:linear-gradient(to bottom,rgba(8,24,18,0.55) 0%,rgba(8,24,18,0.85) 100%);padding:52px 48px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">BingBing Jade &nbsp;·&nbsp; Shipping Update</font></p>
                    <h1 class="banner-heading" style="margin:0 0 24px;font-size:36px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.01em;"><font color="#ffffff">An update on<br>your order</font></h1>
                    ${orderTag}
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

        <!-- ═══ BODY ═══ -->
        <tr>
          <td style="padding:44px 48px 8px;">
            ${bodyParas}
            ${trackingBtn}
            <table cellpadding="0" cellspacing="0" style="margin:0 0 40px;">
              <tr>
                <td style="background:#1a3d35;border-radius:999px;">
                  <a href="${siteUrl}/products" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Browse Our Collection &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 48px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 48px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3d35;">BingBing Jade</p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${YEAR} &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Blog Announcement ─────────────────────────────────────────────────────────

export function buildBlogAnnouncementHtml(params: {
  postTitle: string;
  postExcerpt?: string;
  postImageUrl?: string;
  postUrl: string;
  subject: string;
  unsubscribeUrl: string;
}): string {
  const siteUrl = getSiteUrl();

  const heroBg = params.postImageUrl ?? "";
  const heroBgStyle = heroBg
    ? `background-image:url('${heroBg}');background-size:cover;background-position:center;background-color:#1a3d35;`
    : `background-color:#1a3d35;`;

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
    [data-ogsc] .banner-eyebrow,
    [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading,
    [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
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
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:1200px;height:520px;">
              <v:fill type="frame" src="${heroBg}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="${heroBgStyle}">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:520px;">
                <tr>
                  <td height="520" style="background:linear-gradient(to bottom,rgba(8,24,18,0.55) 0%,rgba(8,24,18,0.14) 100%);padding:100px 80px 96px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 20px;font-size:14px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">BingBing Educational Blog</font></p>
                    <h1 class="banner-heading" style="margin:0 auto;max-width:800px;font-size:48px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;letter-spacing:-0.01em;line-height:1.2;"><font color="#ffffff">${params.postTitle}</font></h1>
                    <table cellpadding="0" cellspacing="0" style="margin:40px auto 0;">
                      <tr>
                        <td style="background:#ffffff;border-radius:999px;">
                          <a href="${params.postUrl}" style="display:inline-block;padding:16px 48px;font-size:17px;font-weight:600;color:#1a3d35;text-decoration:none;letter-spacing:0.02em;white-space:nowrap;">Read Article &rarr;</a>
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

        <!-- ═══ CONTENT ═══ -->
        <tr>
          <td style="padding:48px 60px 40px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">BingBing Educational Blog</p>
            <h2 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${params.postTitle}</h2>
            ${params.postExcerpt ? `<p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">${params.postExcerpt}</p>` : ""}
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr><td style="background:#065f46;border-radius:999px;">
                <a href="${params.postUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Read Article &rarr;</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.7;">Discover more guides and collector insights on the <a href="${siteUrl}/blog" style="color:#059669;text-decoration:none;">BingBing Jade Blog</a>.</p>
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 40px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 40px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3d35;">BingBing Jade</p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${YEAR} &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
            <p style="margin:10px 0 0;font-size:10px;color:#d1d5db;">
              <a href="${params.unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Care Tips ─────────────────────────────────────────────────────────────────

export function buildCareTipsHtml(params: {
  customerName: string | null;
}): string {
  const siteUrl = getSiteUrl();
  const firstName = params.customerName?.split(" ")[0] ?? "Valued customer";

  const body = [
    para(`Dear ${firstName},`),
    para(
      "We hope your piece has settled beautifully into your daily life. Natural jade reveals itself differently over time — and part of its beauty is in how it responds to you."
    ),
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">About Your Piece</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">Your jade is <strong>natural, untreated Type A jadeite</strong> — inherently stable and meant to be worn, not kept away. With time, it may develop a softer, more luminous quality as it becomes part of your life.</p>
      </td></tr>
    </table>`,
    heading("Wearing Your Jade"),
    para(
      "You may wear your jade daily, including through light everyday activities. We simply recommend removing it before situations where it may experience strong impact — such as exercise or heavy lifting."
    ),
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-left:3px solid #065f46;margin:0 0 24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#065f46;">养人，人养玉</p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;font-style:italic;">Jade nourishes you; you nourish jade.</p>
        <p style="margin:10px 0 0;font-size:14px;color:#374151;line-height:1.6;">In traditional understanding, jade responds to its wearer. The natural warmth of your skin gently interacts with the surface over time — which is why many pieces appear more vibrant the longer they are worn.</p>
      </td></tr>
    </table>`,
    heading("Cleaning"),
    para(
      "To clean, simply rinse with lukewarm water and gently wipe with a soft cloth. Ultrasonic cleaners and chemical solutions are entirely unnecessary for natural jade — and best avoided."
    ),
    heading("Storage"),
    para(
      "When not being worn, we recommend storing your piece separately, away from harder materials that may scratch its surface. A soft pouch works beautifully."
    ),
    `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">A Note for Bracelets &amp; Necklaces</p>
        <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">Over time, with regular wear, the cord of your bracelet or necklace may naturally loosen or show wear — this is simply the piece living with you.</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">Should this happen, we are happy to re-string your piece at no charge. Simply send it back to us and we will care for it with the same attention as when it first arrived. When you are ready, just reach out and we will guide you through it.</p>
      </td></tr>
    </table>`,
    para(
      "If you ever have questions about your piece — or anything at all — please do not hesitate to reach out. It is our pleasure to care for the pieces we place, even long after they have found their home with you.",
      "margin-bottom:6px;"
    ),
    para(
      "Warmly,<br><strong style='color:#111827;'>The BingBing Jade Team</strong>",
      "margin-bottom:28px;"
    ),
    ctaButton(`${siteUrl}/products`, "Explore Our Collection"),
  ].join("");

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
    .banner-sub     { color: rgba(255,255,255,0.8) !important; -webkit-text-fill-color: rgba(255,255,255,0.8) !important; }
    [data-ogsc] .banner-eyebrow, [data-ogsb] .banner-eyebrow { color: #6ee7b7 !important; -webkit-text-fill-color: #6ee7b7 !important; }
    [data-ogsc] .banner-heading, [data-ogsb] .banner-heading { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
    [data-ogsc] .banner-sub,     [data-ogsb] .banner-sub     { color: rgba(255,255,255,0.8) !important; -webkit-text-fill-color: rgba(255,255,255,0.8) !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:0;">

      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- ═══ HERO BANNER ═══ -->
        <tr>
          <td style="padding:0;margin:0;">
            <!--[if mso]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:320px;">
              <v:fill type="frame" src="${DELAY_BANNER}" color="#1a3d35"/>
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <div style="background-image:url('${DELAY_BANNER}');background-size:cover;background-position:center;background-color:#1a3d35;">
              <table width="100%" cellpadding="0" cellspacing="0" style="min-height:320px;">
                <tr>
                  <td height="320" style="background:linear-gradient(to bottom,rgba(8,24,18,0.50) 0%,rgba(8,24,18,0.82) 100%);padding:52px 48px;text-align:center;vertical-align:middle;">
                    <p class="banner-eyebrow" style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#6ee7b7!important;-webkit-text-fill-color:#6ee7b7!important;"><font color="#6ee7b7">BingBing Jade</font></p>
                    <h1 class="banner-heading" style="margin:0 0 12px;font-size:34px;font-weight:700;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;line-height:1.2;letter-spacing:-0.01em;"><font color="#ffffff">Caring Tips for<br>Your New Piece</font></h1>
                    <p class="banner-sub" style="margin:0;font-size:15px;color:rgba(255,255,255,0.8)!important;-webkit-text-fill-color:rgba(255,255,255,0.8)!important;line-height:1.6;"><font color="#d1fae5">A personal guide from the BingBing Jade team</font></p>
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

        <!-- ═══ BODY ═══ -->
        <tr>
          <td style="padding:44px 48px 8px;">
            ${body}
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 48px;">
            <div style="height:1px;background:#f3f4f6;"></div>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 48px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3d35;">BingBing Jade</p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${YEAR} &middot;
              <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}
