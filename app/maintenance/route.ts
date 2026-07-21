import { NextResponse } from "next/server";

export const dynamic = "force-static";

const RETRY_AFTER_SECONDS = "1800";
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "12062260891";
const message = "Hi, I saw BingBing Jade is under maintenance and would like to get in touch.";

export function GET() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, follow" />
  <title>BingBing Jade | Maintenance</title>
  <style>
    :root {
      color-scheme: light;
      --jade: #0f5f50;
      --deep-jade: #083b34;
      --gold: #b8954d;
      --ink: #1d2521;
      --muted: #69746f;
      --paper: #fbfaf7;
      --line: rgba(15, 95, 80, 0.16);
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      min-height: 100%;
      margin: 0;
    }

    body {
      display: grid;
      place-items: center;
      padding: 32px 18px;
      background:
        radial-gradient(circle at 50% 0%, rgba(15, 95, 80, 0.09), transparent 34%),
        linear-gradient(180deg, #ffffff 0%, var(--paper) 100%);
      color: var(--ink);
      font-family: Montserrat, Avenir, Helvetica, Arial, sans-serif;
      letter-spacing: 0;
    }

    main {
      width: min(100%, 720px);
      text-align: center;
    }

    .mark {
      display: inline-grid;
      place-items: center;
      width: 64px;
      height: 64px;
      margin-bottom: 28px;
      border: 1px solid var(--line);
      border-radius: 50%;
      color: var(--jade);
      font-family: Georgia, "Times New Roman", serif;
      font-size: 28px;
      line-height: 1;
    }

    .eyebrow {
      margin: 0 0 12px;
      color: var(--gold);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--deep-jade);
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(34px, 7vw, 64px);
      font-weight: 400;
      line-height: 0.95;
    }

    .message {
      max-width: 620px;
      margin: 28px auto 0;
      color: var(--ink);
      font-size: clamp(17px, 2.4vw, 22px);
      line-height: 1.65;
    }

    .secondary {
      max-width: 520px;
      margin: 16px auto 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.8;
    }

    .loader {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 34px 0 30px;
    }

    .loader span {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--jade);
      animation: pulse 1.2s ease-in-out infinite;
    }

    .loader span:nth-child(2) {
      animation-delay: 0.16s;
    }

    .loader span:nth-child(3) {
      animation-delay: 0.32s;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 28px;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--deep-jade);
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: border-color 180ms ease, color 180ms ease, background 180ms ease;
    }

    a:hover {
      border-color: rgba(184, 149, 77, 0.6);
      background: rgba(184, 149, 77, 0.08);
      color: #7a5b22;
    }

    .fine {
      margin-top: 34px;
      color: #9aa39f;
      font-size: 11px;
    }

    @keyframes pulse {
      0%,
      80%,
      100% {
        opacity: 0.3;
        transform: translateY(0);
      }

      40% {
        opacity: 1;
        transform: translateY(-5px);
      }
    }

    @media (max-width: 520px) {
      body {
        padding: 24px 16px;
      }

      .mark {
        width: 56px;
        height: 56px;
        margin-bottom: 24px;
        font-size: 24px;
      }

      .links {
        flex-direction: column;
      }

      a {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">玉</div>
    <p class="eyebrow">BingBing Jade</p>
    <h1>Maintenance</h1>
    <p class="message">We are currently performing improvements to the website to better support increased traffic and improve your shopping experience.</p>
    <p class="secondary">Our site should be back shortly. Thank you for your patience and support.</p>
    <div class="loader" aria-label="Loading">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <nav class="links" aria-label="Contact links">
      <a href="https://www.instagram.com/bingbingjade/" rel="noopener noreferrer">Instagram</a>
      <a href="https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}" rel="noopener noreferrer">WhatsApp</a>
      <a href="mailto:contact@bingbingjade.com">Email</a>
    </nav>
    <p class="fine">Please check back soon.</p>
  </main>
</body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": RETRY_AFTER_SECONDS,
        "Cache-Control": "no-store",
      },
    }
  );
}
