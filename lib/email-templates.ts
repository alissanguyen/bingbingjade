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

export function buildOrderDelayHtml(params: {
  customerName: string | null;
  customMessage?: string;
}): string {
  const siteUrl = getSiteUrl();
  const firstName = params.customerName?.split(" ")[0] ?? "Valued customer";

  const body = params.customMessage
    ? params.customMessage
        .split("\n\n")
        .filter(Boolean)
        .map((p) => para(p.replace(/\n/g, "<br>")))
        .join("")
    : [
        para(`Dear ${firstName},`),
        para(
          "We wanted to reach out personally regarding your recent order with us."
        ),
        para(
          "While your piece is making its way to you, we have encountered a slight delay in transit. Please know that every order we ship receives the same care and attention — and yours is no exception."
        ),
        para(
          "We are actively working to ensure your piece arrives as smoothly and as soon as possible. You need not take any action — we will continue to monitor your shipment closely."
        ),
        para(
          "Thank you for your patience and for the trust you have placed in BingBing Jade. We truly appreciate it."
        ),
        para(
          "Warm regards,<br><strong style='color:#111827;'>The BingBing Jade Team</strong>",
          "margin-bottom:28px;"
        ),
        ctaButton(`${siteUrl}/products`, "Browse Our Collection"),
      ].join("");

  return brandedWrapper(body, siteUrl);
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

  const imageHtml = params.postImageUrl
    ? `<tr><td style="padding:0;"><a href="${params.postUrl}" style="display:block;text-decoration:none;">
        <img src="${params.postImageUrl}" alt="${params.postTitle.replace(/"/g, "&quot;")}" width="560" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;" />
      </a></td></tr>`
    : "";

  const body = [
    imageHtml
      ? `</td></tr>${imageHtml}<tr><td style="padding:36px 40px 32px;">`
      : "",
    `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">From the Journal</p>`,
    `<h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${params.postTitle}</h2>`,
    params.postExcerpt
      ? para(params.postExcerpt, "color:#6b7280;")
      : "",
    ctaButton(params.postUrl, "Read Article"),
    para(
      `Discover more guides and collector insights on the <a href="${siteUrl}/blog" style="color:#059669;text-decoration:none;">BingBing Jade Blog</a>.`,
      "font-size:13px;color:#9ca3af;"
    ),
  ].join("");

  // If no image, use standard wrapper; if image, we inject inline above
  if (!params.postImageUrl) {
    return brandedWrapper(body, siteUrl, params.unsubscribeUrl);
  }

  // Image goes between header and body — build manually
  const footer = `<p style="margin:6px 0 0;font-size:10px;color:#d1d5db;"><a href="${params.unsubscribeUrl}" style="color:#d1d5db;text-decoration:none;">Unsubscribe</a></p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <tr><td style="background:#065f46;padding:28px 40px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">BingBing Jade</h1>
        </td></tr>
        <tr><td style="padding:0;overflow:hidden;">
          <a href="${params.postUrl}" style="display:block;text-decoration:none;">
            <img src="${params.postImageUrl}" alt="" width="560" style="display:block;width:100%;height:240px;object-fit:cover;" />
          </a>
        </td></tr>
        <tr><td style="padding:36px 40px 32px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#059669;">From the Journal</p>
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${params.postTitle}</h2>
          ${params.postExcerpt ? para(params.postExcerpt, "color:#6b7280;") : ""}
          ${ctaButton(params.postUrl, "Read Article")}
          ${para(`Discover more guides and collector insights on the <a href="${siteUrl}/blog" style="color:#059669;text-decoration:none;">BingBing Jade Blog</a>.`, "font-size:13px;color:#9ca3af;")}
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${YEAR} BingBing Jade &middot; <a href="${siteUrl}" style="color:#9ca3af;text-decoration:none;">bingbingjade.com</a></p>
          ${footer}
        </td></tr>
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

  return brandedWrapper(body, siteUrl);
}
