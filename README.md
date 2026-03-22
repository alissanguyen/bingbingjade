# BingBing Jade — Full-Stack E-Commerce Platform

A production e-commerce application for an authentic jade jewelry business, built from the ground up. The platform handles the complete commerce lifecycle — product management, image processing, payment processing, order fulfillment, and inventory tracking — with a polished customer-facing storefront and a full-featured admin CMS.

**Live site:** [bingbingjade.com](https://www.bingbingjade.com)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (private buckets, signed URLs) |
| Payments | Stripe Checkout + Webhooks |
| AI / LLM | Anthropic Claude API (claude-opus-4-6, vision + text) |
| Image Processing | Sharp (native Node.js) |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel (with ISR and serverless functions) |
| Email | EmailJS |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                     │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  Storefront  │   │  Admin CMS   │   │  API Routes    │  │
│  │  (RSC + ISR) │   │  (protected) │   │  (serverless)  │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│           │                 │                    │          │
└───────────┼─────────────────┼────────────────────┼──────────┘
            │                 │                    │
     ┌──────▼──────┐   ┌──────▼──────┐     ┌──────▼──────┐
     │  Supabase   │   │  Supabase   │     │   Stripe    │
     │  Database   │   │  Storage    │     │   Payments  │
     │ (PostgreSQL)│   │(priv.bucket)│     │  + Webhooks │
     └─────────────┘   └─────────────┘     └─────────────┘
```

The application is split into a **customer storefront** and a **password-protected admin panel**, both served from the same Next.js deployment. Server Components handle data fetching and rendering; Client Components handle interactivity (cart, filters, media upload). API routes act as the backend for Stripe payments, image processing, and cache invalidation.

---

## Features

### Customer Storefront

- **Product catalog** with multi-faceted filtering (category, availability status, origin, color, price range, size) and sorting (newest, price ascending/descending)
- **Product detail pages** with full image gallery (lightbox), inline video preview, variant selection (product options with per-option pricing), and add-to-cart
- **Persistent cart** stored in localStorage with a slide-out cart drawer
- **Stripe Checkout** integration — cart contents are re-validated server-side before the Stripe session is created, preventing price manipulation
- **WhatsApp inquiry** links that auto-compose a message with product details and a deep link
- **Contact form** via EmailJS (no server-side email infrastructure required)
- **Fully responsive** design with dark mode support (next-themes)
- **SEO-optimised** product pages with dynamic `<meta>` tags, OpenGraph images, and structured keywords

### Admin CMS (Password-Protected)

- **Add product** — rich form with media upload, image crop (react-easy-crop), video trim, category/origin/color/tier tagging, pricing, and vendor attribution
- **AI-assisted copy generation** — admin can click "Generate Copy" to have Claude analyse the actual uploaded product photos (via vision API) alongside structured product facts and raw vendor notes (Vietnamese or English). Claude generates an elevated product title, a luxury single-paragraph description, and a trust-building blemishes note. All fields are editable before saving. Claude also extracts size, dimensions, origin, and imported price from the vendor notes. A pre-flight token-count check enforces a per-request cost cap ($0.20) before any tokens are billed
- **Edit product** — same full-featured form, pre-populated with existing data; includes lightbox for existing images and inline video preview
- **Draft/publish workflow** — products default to draft and are hidden from the storefront until explicitly published; drafts remain visible in the admin panel and on localhost
- **Bulk operations** — select multiple products to batch-update status (available / on sale / sold) or bulk delete
- **Vendor management** — CRUD for supplier records (Zalo, Facebook, WeChat, TikTok, Other) with platform tagging
- **Beta checkout mode** — checkout locked to admin during soft-launch; toggle to public with a single environment variable

### Image Processing Pipeline

Every uploaded product image goes through an automated server-side processing pipeline before being stored:

1. **EXIF rotation correction** — eliminates sideways iPhone photos
2. **Resize to 2000px max** — reduces 15–20 MB originals by ~70% without visible quality loss at display sizes
3. **Watermark compositing** — SVG logo rasterized by Sharp and composited onto the image; position is category-aware:
   - **Bangle / Necklace** → center-right (the hole/pendant creates empty space there)
   - **All other categories** → bottom-left (avoids obscuring the main subject in center)
4. **Single JPEG encode at quality 90** — single-pass pipeline eliminates double-compression artifacts; no intermediate file written
5. Both the original and watermarked versions are stored in a **private Supabase bucket**, served via short-lived signed URLs

### Payment & Order Processing

The Stripe integration is built with reliability and security as primary concerns:

- **Server-side cart validation** — every item is re-fetched from the database before the Stripe session is created; sold-out items are rejected with a specific error message before the customer reaches Stripe
- **Compact metadata encoding** — cart items serialised as `{p, o?, $}` (UUIDs + price only) and chunked into groups of 4 across separate metadata keys (`items_0`, `items_1`, …) to stay within Stripe's 500-character per-value limit at any cart size
- **Idempotent webhook handler** — the `orders.stripe_session_id` column has a UNIQUE constraint; the handler checks for an existing record before inserting, and handles the PostgreSQL `23505` unique-violation error (from concurrent duplicate delivery) by returning `200 OK` instead of `500`, preventing Stripe's retry loop
- **Automatic inventory update** — on successful payment, the webhook marks purchased options as sold, and auto-marks the parent product as sold when all its options are sold
- **ISR cache invalidation** — the webhook triggers a `POST /api/revalidate` call that clears the Next.js cache for `/`, `/products`, and all `/products/[slug]` pages, so sold-out status is reflected immediately

### Database Design

16 incremental migrations document the full evolution of the schema from a simple product list to a relational order management system:

- `products` — core product record with category, dimensions, pricing, status, slug, origin, and publish state
- `product_options` — variants table (per-option label, size, price, images, status); a NULL label means a single unlabelled variant
- `vendors` — supplier records
- `orders` — Stripe-backed order records (created by webhook, not by application code)
- `order_items` — line-item snapshots preserving product name and price at time of purchase
- **Row Level Security** — `orders` and `order_items` block all public access; only the service-role key can read them. `product_options` allows public read (needed for cart/checkout) but no public write
- **Performance indexes** — `products.status`, `products.category`, `product_options.product_id`, `product_options.status`, `orders.created_at`

---

## Project Structure

```
jade-shop/
├── app/
│   ├── (storefront)
│   │   ├── page.tsx                    # Homepage — featured carousel + recent products
│   │   ├── products/
│   │   │   ├── page.tsx                # Listing — RSC, ISR, multi-filter, pagination
│   │   │   ├── [slug]/
│   │   │   │   ├── page.tsx            # Detail — dynamic SSG + ISR, SEO metadata
│   │   │   │   ├── ProductGallery.tsx  # Lightbox + video preview
│   │   │   │   └── ProductPageClient.tsx # Cart, WhatsApp, options
│   │   │   ├── FilterSidebar.tsx       # Filters with live counts
│   │   │   ├── ProductCardImage.tsx    # Card image (signed URL aware)
│   │   │   └── Pagination.tsx
│   │   ├── checkout/
│   │   │   ├── success/page.tsx        # Order confirmation + cart clear
│   │   │   └── cancel/page.tsx
│   │   ├── contact/                    # EmailJS contact form
│   │   ├── faq/                        # Static FAQ page
│   │   └── policy/                     # Store policy page
│   │
│   ├── (admin — protected by middleware)
│   │   ├── add/                        # New product form + media croppers
│   │   ├── edit/
│   │   │   ├── page.tsx                # Search/bulk operations
│   │   │   └── [id]/                   # Full edit form
│   │   ├── addvendor/                  # New vendor form
│   │   ├── editvendor/                 # Vendor CRUD
│   │   └── admin-login/                # Auth form
│   │
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts       # Cart validation + session creation
│   │   │   ├── webhook/route.ts        # Order creation + inventory update
│   │   │   └── verify-admin/route.ts   # Beta mode gate
│   │   ├── generate-product-copy/
│   │   │   └── route.ts               # Claude vision API — AI copy generation
│   │   ├── upload-image/route.ts       # Image processing pipeline
│   │   ├── create-upload-url/route.ts  # Signed URL for direct video upload
│   │   └── revalidate/route.ts         # ISR cache invalidation
│   │
│   └── components/
│       ├── CartContext.tsx             # Global cart state (React Context)
│       ├── CartDrawer.tsx              # Slide-out cart with checkout
│       ├── Navbar.tsx
│       ├── FeaturedCarousel.tsx
│       └── ...
│
├── lib/
│   ├── claude.ts                       # Anthropic client singleton (server-only)
│   ├── price.ts                        # Price obfuscation helpers
│   ├── watermark.ts                    # Sharp image pipeline
│   ├── storage.ts                      # Signed URL helpers
│   ├── stripe.ts                       # Dual-mode Stripe client
│   ├── supabase.ts                     # Anon client (browser)
│   ├── supabase-admin.ts               # Service-role client (server only)
│   ├── slug.ts                         # URL slug + public ID utilities
│   └── whatsapp.ts                     # Message builder
│
├── supabase/
│   └── migration_001.sql → migration_016.sql
│
├── middleware.ts                        # Admin route protection
└── next.config.ts                       # Sharp config, image remotes, body size
```

---

## Data Flows

### AI Copy Generation

```
Admin uploads photos + fills product facts + pastes vendor notes
  → Click "Generate Copy"
  → Client resizes each image to 1024px JPEG (canvas — AI only, does not affect upload)
  → POST /api/generate-product-copy
      → Auth check (admin_session cookie)
      → Build content array: [image blocks…, text prompt]
      → anthropic.messages.countTokens(content)  ← free, no billing
      → Estimate cost = (input_tokens / 1M) × $15 + (1024 / 1M) × $75
      → Reject with 400 if estimate > $0.20
      → anthropic.messages.create(claude-opus-4-6, content)
          → Claude analyses photos for translucency, texture, color, surface
          → Returns strict JSON: { title, description, blemishes,
                                   size, width, thickness, origin,
                                   imported_price_vnd }
      → Validate + sanitise response
      → Return to client
  → Client prefills name, description, blemishes, size, dimensions,
    origin, imported_price_vnd in existing form fields
  → Admin edits as needed → saves via normal createProduct flow (unchanged)
```

### Product Creation

```
Admin submits form
  → POST /api/upload-image (per image)
      → Sharp: rotate + resize + composite watermark
      → Upload originals/ and wm/ to private Supabase bucket
      → Return storage path
  → POST /api/create-upload-url (per video)
      → Return signed upload URL
      → Client uploads video directly to Supabase
  → Server Action: createProduct
      → INSERT products (paths stored, not URLs)
      → INSERT product_options (one default option minimum)
```

### Purchase

```
Customer clicks Checkout
  → POST /api/stripe/checkout
      → Re-fetch every item from DB (price + status)
      → Reject sold items with specific error
      → Build compact metadata (chunked, short keys)
      → stripe.checkout.sessions.create(...)
      → Return session URL
  → Redirect to Stripe hosted checkout
  → Customer pays
  → Stripe fires checkout.session.completed webhook
      → POST /api/stripe/webhook
          → Verify Stripe signature
          → Check for existing order (idempotency)
          → Parse metadata (compact + legacy formats)
          → Fetch product/option names from DB (snapshot)
          → INSERT orders + order_items
          → UPDATE product_options status = 'sold'
          → UPDATE products status = 'sold' (if all options sold)
          → POST /api/revalidate → next ISR cache clear
  → Redirect to /checkout/success
      → ClearCartOnSuccess clears localStorage
```

### Image Serving

```
Product added → path stored in DB (e.g. "wm/abc123.jpg")
  ↓
Page renders (RSC) → isStoragePath("wm/abc123.jpg") = true
  ↓
resolveImageUrl("wm/abc123.jpg")
  → supabase.storage.from("jade-images").createSignedUrl(..., 86400)
  → Returns https://...supabase.co/storage/v1/sign/...?token=...
  ↓
<Image src={signedUrl} unoptimized />
  → Served directly from Supabase CDN (bypasses Vercel optimizer)
  → Avoids burning Vercel's 1,000/month free optimization quota
     (signed URLs change every ISR cycle = each URL looks "new" to Vercel)
```

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/stripe/checkout` | POST | Beta: x-admin-password header | Validates cart and creates Stripe checkout session |
| `/api/stripe/webhook` | POST | Stripe-Signature header | Handles `checkout.session.completed` events |
| `/api/stripe/verify-admin` | POST | — | Verifies admin password for beta checkout UI |
| `/api/upload-image` | POST | admin_session cookie | Receives image file, applies watermark, uploads to storage |
| `/api/create-upload-url` | POST | admin_session cookie | Returns a signed URL for direct client-side video upload |
| `/api/generate-product-copy` | POST | admin_session cookie | Calls Claude vision API; returns AI-generated title, description, blemishes, and extracted product facts |
| `/api/revalidate` | POST | `?secret=` query param | Clears Next.js ISR cache for product pages |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-only — never expose to client

# Admin
ADMIN_PASSWORD=                     # Protects /add, /edit, and beta checkout

# Stripe — test mode (beta)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Stripe — live mode
STRIPE_LIVE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY=
STRIPE_LIVE_WEBHOOK_SECRET=

# Toggle: "beta" = admin-only test mode | "live" = public live mode
NEXT_PUBLIC_CHECKOUT_MODE=beta

# Site
NEXT_PUBLIC_SITE_URL=https://www.bingbingjade.com
NEXT_PUBLIC_WHATSAPP_NUMBER=        # E.164 format, no +

# EmailJS
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_EMAILJS_NOTIFICATION_TEMPLATE_ID=

# Anthropic Claude API (server-only — never exposed to client)
ANTHROPIC_API_KEY=                  # Required for AI copy generation in admin

# ISR
REVALIDATE_SECRET=                  # Shared secret for /api/revalidate
```

---

## Database Migrations

All schema changes are tracked as numbered SQL files in `/supabase/`. Run them in order against your Supabase project via the SQL editor.

| Migration | Change |
|---|---|
| 001 | Add `videos`, `is_featured`; add ring/pendant/necklace categories |
| 002 | Create public storage buckets |
| 003 | Convert `color` from `text` to `text[]` |
| 004 | Add `status` column (`available` / `sold`) |
| 005 | Add `on_sale` status value |
| 006 | Add `sale_price_usd` |
| 007 | Add pendant & necklace category constraints |
| 008 | Add `size_detailed` (numeric array for multi-dimension measurements) |
| 009 | Convert `tier` from `text` to `text[]` |
| 010 | Add `slug` and `public_id` for SEO URLs |
| 011 | Switch to private storage buckets (`jade-images`, `jade-videos`) |
| 012 | Add `product_options` table (variants with per-option price/images/status) |
| 013 | Add `origin` column (default: Myanmar) |
| 014 | Add `orders` and `order_items` tables |
| 015 | Performance indexes + Row Level Security on `orders`, `order_items`, `product_options` |
| 016 | Add `is_published` (default: `false`) — draft/publish workflow |
| 017 | Make `jade-images` bucket publicly readable (eliminates signed-URL expiry on ISR pages) |
| 018 | Widen `imported_price_vnd` from `integer` to `bigint` (supports values > 2.1 billion VND) |

---

## Local Development

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

In development (`NODE_ENV=development`), draft products are visible on the storefront and labelled with a grey "Draft" badge.

**Stripe webhooks locally:**
Use the Stripe CLI to forward webhook events to your local server:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
The CLI will print a webhook signing secret — use it as `STRIPE_WEBHOOK_SECRET` locally.

---

## Deployment

The application is deployed on Vercel with the following non-default configuration:

- `serverExternalPackages: ["sharp"]` — Sharp is a native Node module and must not be bundled by webpack; this tells Next.js to require it at runtime from the Node.js layer
- `experimental.serverActions.bodySizeLimit: "25mb"` — raised from the 1 MB default to accommodate full-resolution iPhone photos (15–20 MB originals)
- All product images use `unoptimized` on `<Image>` components — Supabase signed URLs contain an expiry token, so each ISR revalidation cycle produces a new URL that Vercel's image optimizer treats as a new image, which would exhaust the free-tier 1,000 optimizations/month quota within days

---

## Key Engineering Decisions

**Why private storage buckets with signed URLs instead of public buckets?**
Public bucket URLs are permanent and predictable. Private buckets require a signed URL (24-hour TTL) to access any file, which means watermarked product images cannot be hotlinked or scraped by simply knowing the path. The tradeoff is that signed URLs must be generated at render time, which adds a small latency cost on cache misses.

**Why a single Sharp pipeline instead of two passes?**
An early implementation resized the image to a JPEG buffer first, then composited the watermark onto that buffer and encoded again. This caused visible degradation (each JPEG encode is lossy). The final implementation computes the post-resize dimensions analytically from the original metadata (`Math.min(1, 2000 / Math.max(w, h))`), positions the watermark against those dimensions, then runs a single pipeline: rotate → resize → composite → JPEG encode. One encode, no quality loss.

**Why compact Stripe metadata with chunked keys?**
Stripe limits each metadata value to 500 characters. A cart with 3+ items whose full product names and UUIDs are serialised as JSON in a single `items` key will silently truncate in the Stripe dashboard and potentially corrupt the webhook payload. The compact format (`{p, o?, $}` — 36-char UUIDs + price, ~97 chars/item) fits 4 items per metadata key well under the limit, and additional keys (`items_0`, `items_1`, …) handle larger carts cleanly. The webhook handler reads all `items_N` keys and also handles the legacy `items` format for backward compatibility.

**Why `revalidatePath("/products/[slug]", "page")` on every webhook?**
When a product sells, its detail page should show "Sold" as close to immediately as possible. The `"page"` variant of `revalidatePath` instructs Next.js to purge the ISR cache for every cached page matching that pattern at once, rather than waiting for each page's 6-hour TTL to expire.

**Why is the checkout idempotency check not sufficient on its own?**
The pre-check (`SELECT id WHERE stripe_session_id = ?`) has a TOCTOU race: two concurrent webhook deliveries can both pass the check before either commits. The UNIQUE constraint on `orders.stripe_session_id` is the actual guard — the application code just avoids returning `500` when it fires (PostgreSQL error code `23505`), so Stripe does not retry unnecessarily.

**Why resize images to 1024px for Claude instead of sending originals?**
iPhone RAW photos are 15–20 MB and encode to several hundred KB in base64. Sending them raw would produce JSON request bodies in the tens of megabytes, approaching Next.js route handler limits and adding unnecessary API latency. Claude's vision model does not need 20-megapixel resolution to analyse colour, translucency, and surface quality — 1024px provides more than enough fidelity. The resize happens entirely on the client via the Canvas API before the request is made, so the actual product upload quality is completely unaffected.

**Why use `countTokens` before calling Claude?**
The generate-copy endpoint includes up to three product photos as base64 image blocks, which can significantly inflate input token counts. A pre-flight `countTokens` call (which is free and not billed) allows the server to estimate the full request cost before issuing it. Requests estimated above the $0.20 cap are rejected with a clear error message, protecting against runaway costs if unusually large images are submitted. The worst-case output cost (1024 tokens × $75/MTok) is included in the estimate.

**Why obfuscate prices above $20,000 rather than hiding them entirely?**
High-value jade pieces ($20k+) attract a different buyer who expects a personal relationship before committing to a purchase. Showing an exact price publicly can invite low-ball offers or comparison shopping that devalues the piece. The obfuscated format (`$2X,XXX`) communicates the price range clearly enough for the buyer to self-qualify, while directing them through an inquiry flow where a proper conversation can happen. "Contact for price" alone tends to be ignored; a visible but intentionally inexact price is more informative and still encourages contact.
