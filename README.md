# BingBing Jade — Full-Stack E-Commerce Platform

A production e-commerce application for an authentic jade jewelry business, built from the ground up. The platform handles the complete commerce lifecycle — product management, image processing, payment processing, order fulfillment, inventory tracking, customer marketing, and referral programs — with a polished customer-facing storefront and a full-featured admin CMS.

**Live site:** [bingbingjade.com](https://www.bingbingjade.com)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (private buckets, signed URLs) |
| Payments | Stripe Checkout + Webhooks + Stripe Tax |
| Transactional Email | Resend (branded HTML templates) |
| AI / LLM | Anthropic Claude API (claude-opus-4-6, vision + text) |
| Image Processing | Sharp (native Node.js) |
| CMS | Sanity (headless, embedded Studio at `/studio`) |
| Styling | Tailwind CSS 4 |
| Testing | Vitest |
| Deployment | Vercel (with ISR and serverless functions) |

> **Note:** EmailJS was removed. All transactional emails (order confirmation, status updates, delivery notifications, subscriber welcome, referral invite/reward) are sent via Resend with custom branded HTML templates.

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

The application is split into a **customer storefront** and a **password-protected admin panel**, both served from the same Next.js deployment. Server Components handle data fetching and rendering; Client Components handle interactivity (cart, filters, media upload). API routes act as the backend for Stripe payments, image processing, email delivery, and cache invalidation.

---

## Features

### Customer Storefront

- **Product catalog** with multi-faceted filtering (category, availability status, origin, color, price range, size) and sorting (newest, price ascending/descending)
- **Product detail pages** with full image gallery (lightbox), inline video preview, variant selection (product options with per-option pricing), and add-to-cart
- **Persistent cart** stored in localStorage with a slide-out cart drawer
- **Zone-based international shipping** — US $20 / Canada+Europe $35 / Asia-Pacific $75 base, +$10–$20 per additional piece; shipping address collected in the storefront UI before redirecting to Stripe so customers never re-enter it; address passed to `payment_intent_data.shipping` for Stripe records
- **Stripe fee gross-up** — transaction fee is computed as `⌈(subtotal + 30) / (1 − rate)⌉ − subtotal` (domestic 2.9%, international 4.4%) so the seller nets exactly the item price after Stripe deducts their cut; displayed as a single "Transaction Fee" line with no formula exposed to customers
- **Automatic WA sales tax** — Stripe Tax (`automatic_tax: { enabled: true }`) with `tax_behavior: "exclusive"` on all line items; triggers only for Washington-state shipping addresses where business nexus is registered; WA customers see an in-cart notice before checkout
- **Shipping insurance option** — 5% of item subtotal (before discount), covers declared value; opt-in toggle in checkout
- **Expedited / Priority Sourcing toggle** in cart drawer with link to `/faq#expedited-shipping` policy
- **Discount code entry** in cart drawer — validated live against `/api/validate-discount`; supports welcome, referral, campaign, and store credit sources
- **Stripe Checkout** integration — cart contents are re-validated server-side before the Stripe session is created, preventing price manipulation; discount is re-validated server-side too
- **Subscribe popup** — appears 2.5 seconds after first visit to homepage; localStorage-gated (shows once per browser); auto-dismisses 1.8s after successful subscription
- **Order tracking page** at `/orders/[orderNumber]` — animated timeline with staggered fade-in, ping ripple on the current step, shimmer flowing down connector lines
- **Hash-based accordion navigation** on `/faq` and `/policy` — clicking an accordion section updates the URL hash; sharing a hash link auto-opens and scrolls to that section
- **WhatsApp inquiry** links that auto-compose a message with product details and a deep link
- **Fully responsive** design with dark mode support (next-themes)
- **SEO-optimised** product pages with dynamic `<meta>` tags, OpenGraph images, and structured keywords

### Educational Blog (Sanity CMS)

- **Headless CMS integration** — Sanity Studio embedded at `/studio` (localhost-only; middleware redirects all non-localhost traffic to `/`; full site chrome stripped so the Studio renders full-screen without navbar interference)
- **Blog listing page** (`/blog`) — featured post rendered as a large split-panel hero; remaining posts in a responsive card grid with 16:9 cover images, category pills, author name, and subtle hover animations; cover images resolved via `urlFor()` builder against Sanity CDN
- **Post detail page** (`/blog/[slug]`) — category badges, author avatar + name + date, full-bleed hero image (rounded on desktop, edge-to-edge on mobile), portable text body, numbered sources section, author bio, "Continue Reading" recommended posts strip, related products grid
- **Portable text renderer** — custom components for `h2`/`h3`/`h4`, paragraphs, blockquotes, bullet/numbered lists, inline code, internal and external links; plus rich content blocks: `articleImage` (inline / wide / full-width layouts with caption), `pullQuote` (left emerald border + optional attribution), `callout` (info / tip / warning / luxury tones), `productReference` (linked product card with thumbnail + price)
- **Rich post schema** — title, slug, excerpt, hero image (with alt + caption + hotspot), portable text body, author reference, categories, related products, **recommended posts** (up to 3 cross-links to other articles), sources (label + URL), SEO object (metaTitle, metaDescription, OG image, canonical URL, noIndex), featured flag
- **Full SEO** — `generateMetadata()` per post using Sanity SEO fields; `generateStaticParams()` for build-time static generation; `revalidate: 3600` for hourly ISR refresh

### Admin CMS (Password-Protected)

- **Add product** — rich form with media upload, image crop (react-easy-crop), video trim, category/origin/color/tier tagging, pricing, and vendor attribution
- **AI-assisted copy generation** — admin can click "Generate Copy" to have Claude analyse the actual uploaded product photos (via vision API) alongside structured product facts and raw vendor notes (Vietnamese or English). Claude generates an elevated product title, a luxury single-paragraph description, and a trust-building blemishes note. All fields are editable before saving. Claude also extracts size, dimensions, origin, and imported price from the vendor notes. A pre-flight token-count check enforces a per-request cost cap ($0.20) before any tokens are billed
- **Edit product** — same full-featured form, pre-populated with existing data; includes lightbox for existing images and inline video preview
- **Draft/publish workflow** — products default to draft and are hidden from the storefront until explicitly published
- **Bulk operations** — select multiple products to batch-update status (available / on sale / sold) or bulk delete
- **Order management** — admin panel at `/orders-admin` lists all orders sorted by order number descending; two-column amount display separates "Items" (sum of `order_items.price_usd × quantity`) from "Total" (full `amount_total` including shipping/fees/tax); search, status filtering, and pagination; each order has a full detail/edit page supporting:
  - Status updates with optional email notification to customer
  - Estimated delivery date (triggers automatic delivery-date email)
  - Inline editing of order items (price, quantity) with auto-recalculated total
  - Shipping address edit (create or update linked `customer_addresses` record)
  - Fee breakdown editor (shipping, tax, PayPal, insurance, discount, custom line)
  - Customer info edit (name, email, phone, order number, order date)
  - Notes field
- **Accounting dashboard** (`/accounting-admin`) — financial reporting page with:
  - **KPI cards** — Total Collected (all payments including shipping/fees/tax), Item Revenue (jade product prices only), COGS, and Gross Profit with margin %
  - **Pure SVG bar chart** — no chart library dependencies; dual-series (emerald for revenue, rose for COGS) with year filter; overflow-scroll on mobile
  - **Annual summary table** — Total Collected / Item Revenue / COGS / Gross Profit / Margin % per year
  - **By payment source breakdown** — horizontal progress bars showing revenue split across Stripe, PayPal, Cash, Zelle, Wire, Manual
  - **COGS tracking** — `imported_price_vnd` captured at webhook time (frozen to the price at time of sale), converted at a fixed 1 USD = 26,000 VND rate, stored as `cogs_cents` on the order; profit columns gracefully hidden for orders without COGS data (`hasCogs` flag)
- **Custom order entry** — admin can create manual orders (Cash/Zelle/PayPal/Stripe/Wire Transfer source); order numbers prefixed `BBJ-` with a minimum value enforced; customer and address records created or linked automatically
- **Vendor management** — CRUD for supplier records
- **Coupon campaign management** (`/coupons-admin`) — create seasonal/promotional codes with configurable discount type (fixed, percent, or tiered $10/$20), active date window, minimum order amount, per-customer and global redemption caps, and new-customer restriction; toggle active/inactive; live redemption count per campaign
- **Subscriber management** (`/subscribers-admin`) — view all email subscribers with their coupon code, expiry, and status (Active / Used / Expired / No code); filter tabs; resend welcome coupon email to individual subscriber; bulk email with custom subject and message body targeting all or unused-coupon subscribers; backfill coupon codes for pre-migration subscribers
- **Admin profile** (`/profile`) — at-a-glance action items: pending product approvals and pending partner token requests with inline approve/deny and adjustable grant amount
- **Beta checkout mode** — checkout locked to admin during soft-launch; toggle to public with `NEXT_PUBLIC_CHECKOUT_MODE=live`

### Partner Portal (Approved Users)

A separate authenticated portal for trusted vendor partners with a distinct `approved_session` cookie and HMAC-signed user ID.

- **Scoped product creation** — partners can add new listings; products are saved as `pending_approval = true` and hidden from the storefront until admin approves
- **Scoped product editing** — proposed edits are stored in a `pending_data` JSONB column; the live listing is untouched until admin approves; dismissed edits discard `pending_data`
- **Pending approval queue** — admin sees a dedicated section in `/products-admin` with approve/dismiss actions; dismissed new listings record `rejected_at` so partners can see why
- **Partner profile** (`/profile`) — shows pending submissions, rejected submissions with admin notes, token balance, token request history, and a Tasks placeholder
- **AI copy generation with token budget** — partners share the same Claude generation feature as admin but consume from a personal token balance (default 10); requests are blocked at 0 tokens with a clear error message; each successful generation atomically decrements the balance
- **Token request flow** — partner submits a request with an optional message; admin sees it in `/admin` profile with inline approve/deny, adjustable grant amount, and optional admin note; only one pending request allowed at a time
- **Access levels** — `standard` and `senior` (reserved for future expansion); `imported_price_vnd` (profit margin) is always stripped from partner-facing responses
- **Partner navbar** — full admin bar with links scoped to partner-accessible pages; logout redirects to `/approved-login`

### Image Processing Pipeline

Every uploaded product image goes through an automated server-side processing pipeline before being stored:

1. **EXIF rotation correction** — eliminates sideways iPhone photos
2. **Resize to 2000px max** — reduces 15–20 MB originals by ~70%
3. **Watermark compositing** — SVG logo rasterized by Sharp; position is category-aware:
   - **Bangle / Necklace** → center-right
   - **All other categories** → bottom-left
4. **Single JPEG encode at quality 90** — one-pass pipeline eliminates double-compression artifacts
5. Both originals and watermarked versions stored in a private Supabase bucket, served via short-lived signed URLs

### Payment & Order Processing

- **Server-side cart validation** — every item re-fetched from DB; sold-out items rejected before reaching Stripe
- **Server-side discount validation** — `validateDiscount()` runs at checkout time; client-reported discount amount is ignored; only the server's recomputed amount is used
- **Compact metadata encoding** — cart items serialised as `{p, o?, $}` chunked across `items_0`, `items_1`, … keys (≤500 chars/value Stripe limit)
- **Idempotent webhook handler** — `orders.stripe_session_id` UNIQUE constraint; `23505` error code handled to prevent Stripe retry loops
- **Automatic inventory update** — webhook marks purchased options sold, auto-marks parent product sold when all options are sold
- **ISR cache invalidation** — webhook triggers `/api/revalidate` to clear Next.js cache for product pages immediately

### Discount & Referral System

A production-hardened discount engine with no stacking (exactly one discount source per order) and full abuse prevention. All validation is server-side — the client is never trusted for discount amounts.

**Sources (priority order):**

| Priority | Source | Amount | Eligibility |
|---|---|---|---|
| 1 | Explicit code → referral | Tiered ($10/$20) | New customers only, no self-referral, no duplicate |
| 2 | Explicit code → subscriber welcome coupon | Tiered ($10/$20) | Code tied to subscriber email, 30-day expiry, first order only |
| 3 | Explicit code → campaign | Configurable | Per campaign rules |
| 4 | Store credit (auto) | Full balance (capped at subtotal) | Any customer |
| 5 | Welcome (auto, legacy) | Tiered ($10/$20) | Pre-migration subscribers without a code |

**Tiered discount:** subtotal ≥ $150 → $20 off; subtotal < $150 → $10 off. Computed server-side at checkout time so cart-size manipulation cannot lock in the higher tier.

**Welcome coupon codes:**
- Each new subscriber receives a unique 6-digit numeric code (100000–999999) via the welcome email
- Code is cryptographically generated (`crypto.randomInt`), stored with a 30-day expiry in `email_subscribers`
- Validated by matching code to subscriber email — prevents sharing between accounts
- Collision-safe: up to 10 retry attempts on duplicate code generation
- **Abuse prevention:** after redemption, a shipping fingerprint (`phone|city|postal|country`) is stored on the subscriber record; duplicate fingerprints on separate redeemed coupons emit a server-side warning log; order still completes (no silent blocking)
- Backward compat: subscribers without a code (pre-migration) still receive auto-applied welcome discount; admin can generate codes for them via "Backfill Coupons" in `/subscribers-admin`

**Referral program:**
- After a customer's first delivered order, they receive a referral code and an invite email
- Referred friend gets tiered discount on their first order
- Referrer earns $10 store credit when the referred friend's order is delivered (idempotent — reward issued exactly once, checked by referral status field)
- Self-referral and duplicate referral use are blocked server-side

**Campaign coupons:** `coupon_campaigns` table supports fixed/percent/tiered discount types, active date windows, new-customer restrictions, per-customer and global redemption caps. Created and managed from `/coupons-admin`.

**Email subscribers (`/api/subscribe`):**
- Upserts email into `email_subscribers`; returns `{ alreadySubscribed: true }` for duplicates (idempotent, handles `23505` race)
- Generates and assigns a 6-digit coupon code with 30-day expiry (non-blocking; email failure does not fail subscription)
- Syncs `marketing_opt_in` on matching customer record

**Discount commit (`commitDiscount`):**
- Called from Stripe webhook after payment confirmed — never before
- Uses `.is("welcome_discount_redeemed_at", null)` guard for idempotency
- Inserts `coupon_redemptions` or `referrals` record; links IDs back to order
- On welcome source: stores shipping fingerprint for abuse detection

**Post-delivery flows (non-fatal, in admin orders PATCH):**
1. Set `first_delivered_order_at` on customer
2. If order has `referral_id`: call `processReferralRewardOnDelivery()`, send reward email to referrer
3. If first delivery: generate referral code via `ensureReferralCode()`, send referral invite email to customer

### Email System (Resend)

All transactional emails use custom branded HTML templates and are BCC'd to `bingbing.jade2@gmail.com`. Subject lines are prefixed for Gmail filter-based sorting:

| Subject prefix | Emails |
|---|---|
| `[Order Placed]` | Order confirmation |
| `[Order Update]` | Status change, delivery date update, referral invite, referral reward |
| `[Subscriber]` | Welcome newsletter email |

**Unsubscribe:** `/api/unsubscribe?e=<base64-email>` removes the subscriber record and renders a confirmation page. A subtle 10px light-gray link is embedded in welcome email footers (CAN-SPAM compliant, intentionally unobtrusive).

---

## Project Structure

```
jade-shop/
├── app/
│   ├── page.tsx                        # Homepage — subscribe popup + featured carousel
│   ├── products/
│   │   ├── page.tsx                    # Listing — RSC, ISR, multi-filter
│   │   └── [slug]/page.tsx             # Detail — SSG + ISR, SEO metadata
│   ├── orders/[orderNumber]/
│   │   ├── page.tsx                    # Order status page (server)
│   │   └── OrderTimeline.tsx           # Animated timeline (client component)
│   ├── faq/page.tsx                    # FAQ — accordion with hash navigation + IDs
│   ├── policy/page.tsx                 # Policy — accordion with hash navigation + IDs
│   ├── checkout/
│   │   ├── success/page.tsx
│   │   └── cancel/page.tsx
│   ├── contact/
│   │
│   ├── orders-admin/
│   │   ├── page.tsx                    # Order list — sorted by order number, Items+Total split
│   │   ├── [id]/page.tsx               # Order detail / edit (strips cogs_cents before client)
│   │   └── new/page.tsx                # Create manual order
│   ├── accounting-admin/
│   │   ├── page.tsx                    # Server wrapper (force-dynamic)
│   │   └── AccountingClient.tsx        # KPI cards, SVG chart, annual table, source breakdown
│   ├── customers-admin/
│   ├── studio/
│   │   └── [[...tool]]/page.tsx        # Sanity Studio (force-dynamic; localhost-only via middleware)
│   │
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts       # Cart + discount validation → Stripe session
│   │   │   └── webhook/route.ts        # Order creation + COGS capture + inventory + discount commit
│   │   ├── admin/
│   │   │   ├── orders/route.ts         # Order list — joins order_items for item_subtotal
│   │   │   ├── orders/[id]/route.ts    # Order CRUD + email triggers + delivery flows
│   │   │   └── accounting/route.ts     # Monthly/annual revenue, COGS, by-source aggregation
│   │   ├── subscribe/route.ts          # Email list signup + welcome email
│   │   ├── validate-discount/route.ts  # Read-only discount preview for cart drawer
│   │   ├── unsubscribe/route.ts        # One-click unsubscribe (base64 email param)
│   │   ├── generate-product-copy/route.ts
│   │   ├── upload-image/route.ts
│   │   ├── create-upload-url/route.ts
│   │   └── revalidate/route.ts
│   │
│   └── components/
│       ├── CartContext.tsx
│       ├── CartDrawer.tsx              # Shipping toggle, discount UI, fee breakdown
│       ├── SubscribeForm.tsx           # Full + compact variants; onSuccess callback
│       ├── SubscribePopup.tsx          # localStorage-gated modal (first visit only)
│       ├── Accordion.tsx               # Hash-aware accordion (URL sync + auto-scroll)
│       ├── Navbar.tsx
│       ├── FeaturedCarousel.tsx
│       └── ...
│
├── lib/
│   ├── discount.ts                     # Validation, commit, referral reward, code gen
│   ├── discount-emails.ts              # Welcome, referral invite, referral reward emails
│   ├── orders.ts                       # Confirmation, status, delivery date emails; helpers
│   ├── stripe-metadata.ts              # Compact encode/decode + discount metadata
│   ├── claude.ts
│   ├── watermark.ts
│   ├── storage.ts
│   ├── stripe.ts
│   ├── supabase.ts
│   ├── supabase-admin.ts
│   ├── slug.ts
│   ├── price.ts
│   └── sanity/
│       ├── client.ts                   # Sanity client + urlFor image builder
│       └── queries.ts                  # GROQ queries (post list, post by slug, related posts)
│
├── sanity/
│   ├── schemaTypes/                    # Post, Author, Category, Product Reference schemas
│   └── sanity.config.ts
│
├── __tests__/
│   └── discount.test.ts                # 34 Vitest tests — logic, abuse, flow
│
├── supabase/
│   └── migration_001.sql → migration_048.sql
│
├── middleware.ts
└── next.config.ts
```

---

## Data Flows

### Checkout with Discount

```
Customer fills email + optional discount code in cart drawer
  → POST /api/validate-discount (read-only preview)
      → validateDiscount() — checks referral, campaign, store credit, welcome
      → Returns { valid, source, discountAmountCents, displayMessage }
  → Cart displays discounted total + transaction fee on discounted amount
  → Customer clicks Checkout
  → POST /api/stripe/checkout
      → Re-validate all items (price + sold status)
      → Re-run validateDiscount() server-side (client discount amount ignored)
      → Build line items: items + shipping + tx fee + discount (negative)
      → Encode discount into Stripe session metadata
      → stripe.checkout.sessions.create(...)
  → Redirect to Stripe hosted checkout
  → Customer pays
  → Stripe fires checkout.session.completed
      → POST /api/stripe/webhook
          → Decode discountMeta from metadata
          → Prefer metadata.cust_email over Stripe-collected email
          → INSERT order with discount columns
          → commitDiscount() — idempotent writes to coupon_redemptions/referrals
          → Link coupon_redemption_id / referral_id back to order
          → Send order confirmation email (Resend)
          → Trigger ISR revalidation
```

### Post-Delivery Referral Flow

```
Admin marks order as "delivered"
  → PATCH /api/admin/orders/[id]
      → Update order_status
      → Send status email if requested
      → Send delivery date email if date changed
      → (if orderStatus === "delivered" && customer_id)
          → Set first_delivered_order_at on customer (if null)
          → (if order.referral_id)
              → processReferralRewardOnDelivery()
                  → Check referral.status not already "rewarded" (idempotency)
                  → INSERT store_credit_ledger (type: referral_reward)
                  → UPDATE customers SET store_credit_balance += 10
                  → UPDATE referral SET status = "rewarded"
              → Send referral reward email to referrer
          → (if first delivery && customer has name)
              → ensureReferralCode() — 8-char code, no 0/1/I/O/L, retry on collision
              → Send referral invite email to customer
```

### AI Copy Generation

```
Admin uploads photos + fills product facts + pastes vendor notes
  → Click "Generate Copy"
  → Client resizes each image to 1024px JPEG (Canvas API)
  → POST /api/generate-product-copy
      → Auth check (admin_session cookie)
      → Build content array: [image blocks…, text prompt]
      → anthropic.messages.countTokens(content)  ← free, no billing
      → Estimate cost = (input_tokens / 1M) × $15 + (1024 / 1M) × $75
      → Reject with 400 if estimate > $0.20
      → anthropic.messages.create(claude-opus-4-6, content)
      → Validate + return strict JSON: { title, description, blemishes,
                                         size, width, thickness, origin,
                                         imported_price_vnd }
  → Client prefills form fields → admin edits → saves normally
```

### Image Serving

```
Product added → path stored in DB (e.g. "wm/abc123.jpg")
  ↓
Page renders (RSC) → resolveImageUrl("wm/abc123.jpg")
  → supabase.storage.from("jade-images").createSignedUrl(..., 86400)
  → Signed URL (24h TTL) served directly from Supabase CDN
  → Bypasses Vercel image optimizer (avoids 1,000/month free quota)
```

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/stripe/checkout` | POST | Beta: `x-admin-password` header | Validates cart + discount, creates Stripe session |
| `/api/stripe/webhook` | POST | `Stripe-Signature` header | Handles `checkout.session.completed` |
| `/api/admin/orders/[id]` | GET | `admin_session` cookie | Fetch order details |
| `/api/admin/orders/[id]` | PATCH | `admin_session` cookie | Update order — status, delivery date, items, address, fees |
| `/api/subscribe` | POST | — | Add email to subscribers list; generate 6-digit coupon; fire welcome email |
| `/api/validate-discount` | POST | — | Preview discount (read-only); returns amount + message |
| `/api/unsubscribe` | GET | — | Remove email from subscribers (`?e=<base64-email>`) |
| `/api/upload-image` | POST | `admin_session` cookie | Watermark + upload product image |
| `/api/create-upload-url` | POST | `admin_session` cookie | Signed URL for direct video upload |
| `/api/generate-product-copy` | POST | session cookie | Claude vision → title, description, blemishes, facts; token-gated for partners |
| `/api/revalidate` | POST | `?secret=` query param | Clear Next.js ISR cache for product pages |
| `/api/admin/coupons` | GET / POST | `admin_session` cookie | List campaigns with redemption counts / create campaign |
| `/api/admin/coupons/[id]` | PATCH | `admin_session` cookie | Update campaign (toggle active, edit fields) |
| `/api/admin/subscribers` | GET | `admin_session` cookie | List subscribers filtered by status |
| `/api/admin/subscribers/[id]/resend` | POST | `admin_session` cookie | Resend welcome coupon email to subscriber |
| `/api/admin/subscribers/bulk-email` | POST | `admin_session` cookie | Send broadcast email to all or unused-coupon subscribers |
| `/api/admin/subscribers/backfill-coupons` | POST | `admin_session` cookie | Generate codes for all pre-migration subscribers without one |
| `/api/admin/token-requests/[id]` | PATCH | `admin_session` cookie | Approve or deny partner token request |
| `/api/approved/login` | POST | — | Partner login → sets `approved_session` cookie |
| `/api/approved/logout` | POST | — | Partner logout |
| `/api/approved/token-request` | POST | `approved_session` cookie | Submit token request to admin |
| `/api/admin/products/[id]/approve` | PATCH | `admin_session` cookie | Approve or dismiss a pending product submission |
| `/api/admin/accounting` | GET | `admin_session` cookie | Monthly/annual revenue + COGS aggregation; by-source breakdown; `hasCogs` flag |
| `/api/admin/orders` | GET | `admin_session` cookie | Paginated order list with joined `item_subtotal` (sum of `price_usd × quantity`) |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-only — never expose to client

# Admin
ADMIN_PASSWORD=                     # Protects /add, /edit, beta checkout, admin API routes

# Stripe — test mode
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Stripe — live mode
STRIPE_LIVE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY=
STRIPE_LIVE_WEBHOOK_SECRET=

# Toggle: "beta" = admin-only | "live" = public
NEXT_PUBLIC_CHECKOUT_MODE=beta

# Resend (transactional email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=BingBing Jade <orders@bingbingjade.com>

# Site
NEXT_PUBLIC_SITE_URL=https://www.bingbingjade.com
NEXT_PUBLIC_WHATSAPP_NUMBER=        # E.164 format, no +

# Anthropic Claude API (server-only)
ANTHROPIC_API_KEY=

# ISR
REVALIDATE_SECRET=                  # Shared secret for /api/revalidate
```

---

## Database Migrations

All schema changes are tracked as numbered SQL files in `/supabase/`. Run them in order via the Supabase SQL editor.

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
| 018 | Widen `imported_price_vnd` from `integer` to `bigint` (supports values > 2.1B VND) |
| 019–025 | Customer records, `customers` table, `customer_addresses`; order tracking fields; order number (`BBJ-XXXX`); admin order CRUD schema; `source` column (Cash/Zelle/PayPal/Stripe/Wire/Manual) |
| 026 | Add `quick_ship` flag to products; `order_type` (standard/custom); fee breakdown JSON on orders |
| 027 | Add `stripe_payment_intent_id`; expand order status values (`in_production`, `polishing`, `quality_control`, `certifying`, `inbound_shipping`, `outbound_shipping`, `delivered`, `order_cancelled`) |
| 028 | Admin order editable fields: `customer_phone_snapshot`, `created_at`, `order_type`, `fee_breakdown`, `order_items` inline editing |
| 029 | `referral_id` column on orders; link manual orders to referral/coupon records |
| 030 | Full discount & referral schema: `email_subscribers`, `coupon_campaigns`, `coupon_redemptions`, `referrals`, `store_credit_ledger`; customer columns: `marketing_opt_in`, `referral_code`, `store_credit_balance`, `paid_order_count`, `first_paid_order_at`, `first_delivered_order_at`, `welcome_discount_redeemed_at`; order columns: `discount_source`, `discount_amount_cents`, `subtotal_before_discount_cents`, `coupon_redemption_id`, `referral_id` |
| 031 | Partner portal: `approved_users` table (email, full_name, access_level, password_hash, is_active); `orders.created_by` column |
| 032 | Pending approval workflow: `products.pending_approval`, `products.pending_data`, `products.created_by` |
| 033 | Rejection tracking: `products.rejected_at`, `products.rejection_note` |
| 034 | Partner token system: `approved_users.generation_tokens` (default 10); `token_requests` table (user_id, message, requested_amount, status, granted_amount, admin_note, resolved_at) |
| 035 | Subscriber coupon codes: `email_subscribers.welcome_coupon_code` (CHAR 6, unique), `welcome_coupon_expires_at`, `used_fingerprint`; `coupon_campaigns.created_by`, `coupon_campaigns.notes` |
| 036–047 | Partner portal refinements, sourcing workflow, approved-user access controls, shipment tracking, token request improvements |
| 048 | Add `cogs_cents integer` to `orders` — stores cost of goods sold in USD cents, captured at webhook time from `imported_price_vnd` at a fixed 1 USD = 26,000 VND rate |

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in all variables
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Draft products are visible on the storefront in development and labelled with a grey "Draft" badge.

**Stripe webhooks locally:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
The CLI prints a signing secret — use it as `STRIPE_WEBHOOK_SECRET` locally.

**Tests:**
```bash
npx vitest run
```

---

## Deployment

Deployed on Vercel with the following non-default configuration:

- `serverExternalPackages: ["sharp"]` — Sharp is native and must not be webpack-bundled; required at runtime from the Node.js layer
- `experimental.serverActions.bodySizeLimit: "25mb"` — raised from 1 MB to accommodate full-resolution iPhone photos
- `<Image unoptimized>` on product images — signed URLs expire and regenerate each ISR cycle; Vercel's optimizer treats each new URL as a new image and would exhaust the 1,000/month free quota within days

---

## Key Engineering Decisions

**Why private storage buckets with signed URLs instead of public buckets?**
Public bucket URLs are permanent and predictable — watermarked product images could be hotlinked or scraped by knowing the path. Private buckets require a signed URL (24-hour TTL) to access any file. The tradeoff is a small latency cost on cache misses when signed URLs must be generated at render time.

**Why a single Sharp pipeline instead of two passes?**
An early implementation resized to a JPEG buffer first, then composited the watermark onto that buffer and encoded again. This caused visible degradation (each JPEG encode is lossy). The final implementation computes post-resize dimensions analytically from original metadata, positions the watermark against those dimensions, then runs a single pipeline: rotate → resize → composite → JPEG. One encode, no quality loss.

**Why compact Stripe metadata with chunked keys?**
Stripe limits each metadata value to 500 characters. A cart with 3+ items serialised as JSON in a single `items` key will silently truncate. The compact format (`{p, o?, $}` — UUIDs + price, ~97 chars/item) fits 4 items per key well under the limit; additional `items_1`, `items_2`, … keys handle larger carts. The webhook handler reads all `items_N` keys and also handles the legacy `items` format.

**Why is the discount re-validated server-side at checkout time?**
The cart drawer calls `/api/validate-discount` for a live preview, but this result is never trusted at checkout. The checkout route calls `validateDiscount()` independently from the fresh cart. This prevents a class of attack where a user inflates their subtotal to lock in the $20 tier in the preview, then reduces their cart before submitting — the server recomputes from the validated item prices. Similarly, the client never sends a discount amount; it only sends the email and optional code.

**Why use `commitDiscount()` from the webhook rather than the checkout API?**
Committing a discount (marking it redeemed, inserting a coupon_redemption row) must happen only after payment is confirmed. If it happened at session creation time, a user could repeatedly start checkout sessions to exhaust a campaign's global redemption cap without paying. The webhook fires on `checkout.session.completed` — confirmed payment — and the `23505` idempotency guard means duplicate webhook deliveries do not double-count redemptions.

**Why store credit spending is earning-only for now?**
Without a session-based auth system, any email-based claim at checkout is unauthenticated — an attacker who knows a customer's email could claim their store credit. Earning is fully implemented (referral reward → `store_credit_ledger`). Spending at checkout requires the customer to be logged in (verified identity) and is deferred to when account creation is added.

**Why `revalidatePath("/products/[slug]", "page")` on every webhook?**
When a product sells, its detail page must show "Sold" as close to immediately as possible. The `"page"` variant purges the ISR cache for every cached page matching that pattern at once, rather than waiting for each page's TTL to expire.

**Why is the checkout idempotency check not sufficient on its own?**
The pre-check (`SELECT id WHERE stripe_session_id = ?`) has a TOCTOU race: two concurrent webhook deliveries can both pass the check before either commits. The UNIQUE constraint on `orders.stripe_session_id` is the actual guard — the application code just avoids returning `500` when it fires (`23505`), so Stripe does not retry unnecessarily.

**Why resize images to 1024px for Claude instead of sending originals?**
iPhone photos are 15–20 MB and encode to hundreds of KB in base64. Sending originals would produce tens-of-megabyte request bodies and add API latency. Claude's vision model does not need 20-megapixel resolution to analyse colour, translucency, and surface quality — 1024px provides sufficient fidelity. The resize happens client-side via Canvas before the API call; upload quality is completely unaffected.

**Why use `countTokens` before calling Claude?**
The generate-copy endpoint includes up to three product photos as base64 image blocks, which can significantly inflate input token counts. A pre-flight `countTokens` call (free, not billed) allows the server to estimate full request cost before issuing it. Requests estimated above $0.20 are rejected, protecting against runaway costs if unusually large images are submitted.

**Why obfuscate prices above $20,000?**
High-value jade pieces attract buyers who expect a personal relationship before committing. Showing an exact price publicly invites comparison shopping and low-ball offers. The obfuscated format (`$2X,XXX`) communicates the price range for self-qualification while directing buyers toward an inquiry flow. "Contact for price" alone tends to be ignored; a visible but inexact price is more informative and still encourages contact.

**Why capture COGS at webhook time rather than reading it from the products table on demand?**
`imported_price_vnd` on a product record can change at any time — the vendor's price fluctuates, we re-negotiate, or the product is deleted after it sells. Storing `cogs_cents` on the order at the moment of sale creates an immutable snapshot of what the piece actually cost us for that transaction. Historical profit calculations then remain accurate regardless of how the product record changes afterward. This mirrors how Stripe captures the price on each PaymentIntent rather than re-reading the price table later.

**Why use a fixed VND/USD rate (26,000) rather than a live exchange API?**
Importing costs are negotiated and recorded in VND weeks before products sell. The actual FX rate on any given sale date introduces noise that doesn't reflect the economics of the specific batch. A fixed operational rate also means the accounting dashboard stays deterministic — reloading the page always produces the same profit figure. If the rate drifts significantly, a single migration updating the constant is cheaper than debugging time-varying P&L.

**Why strip `cogs_cents` in the server component before passing to the client, rather than relying on RLS?**
RLS governs database-level access; it does not prevent an authenticated server component from leaking data to a client component via props. The orders admin page used `select('*')` which included `cogs_cents` in the serialised order object sent to `<OrderDetailClient>` — and client component props are visible in React DevTools and the Next.js RSC payload. Destructuring the field on the server before passing `orderForClient` to the client component ensures it never appears in the network payload, regardless of what future wildcard selects might add to the table.

**Why detect `/studio` with a dedicated middleware header (`x-is-studio`) instead of reading `x-pathname` in the root layout?**
The initial implementation conditionally rendered the navbar by checking `pathname.startsWith("/studio")` from `x-pathname`. This worked in development but broke in production: the studio page had `export const dynamic = "force-static"`, so Next.js served it from the build cache without re-running middleware on each request. The root layout's `headers()` call then received stale headers from the last non-studio request, and the navbar rendered over the Sanity UI. The fix has two parts: (1) change the studio page to `force-dynamic` so middleware always runs, and (2) set a dedicated `x-is-studio: "1"` header in middleware so the signal is unambiguous and does not depend on pathname string parsing in the layout.

**Why subject-line prefixes for Gmail sorting instead of custom headers?**
Custom email headers (`X-BBJ-Category: Order Update`) are not surfaced in Gmail's filter UI and cannot be used to create label rules without raw message parsing. Subject-line prefixes (`[Order Update]`, `[Order Placed]`, `[Subscriber]`) work with Gmail's built-in filter UI — create a filter for `Subject contains [Order Update]` and apply a label. Simple, reliable, no tooling required.

**Why 6-character alphanumeric codes for subscriber coupons?**
Six characters from a 32-character unambiguous alphabet (no 0/O/1/I/L) yields 32⁶ = ~1 billion combinations, making collision essentially impossible at any realistic subscriber count. The charset excludes visually similar characters to prevent transcription errors when customers type the code from an email. Campaign codes use freeform uppercase strings (e.g. `BLACKFRI25`) which are manually chosen, human-readable, and deliberately memorable.

**Why is the subscriber coupon tied to the subscriber's email?**
Without tying the code to an email, customers could share their coupon with anyone. Binding it means validation requires both the correct email and the correct code, maintaining first-time-customer intent. The tradeoff is that the code cannot be used as a "gift" code — that use case is served by campaign coupons.

**Why does abuse fingerprinting warn rather than block?**
Blocking an order post-payment would create a refund workflow and a hostile customer experience for false positives (e.g. two siblings in the same house who both subscribe). A log warning gives the admin visibility to investigate manually without taking irreversible automated action. Phone-number verification (future) will provide a more reliable signal to block on.

**Why use HMAC-signed cookies for partner sessions instead of JWTs or DB sessions?**
The HMAC approach (`userId.HMAC-SHA256(userId, ADMIN_PASSWORD)`) verifies authenticity without a DB lookup in middleware, reducing latency on every request. The cookie is still validated against the `approved_users` table (checking `is_active`) on each protected page — the HMAC just proves the cookie wasn't forged. JWTs would add serialization overhead; DB sessions would require a sessions table and GC logic.

**Why store `pending_data` as JSONB instead of creating a separate edit-proposals table?**
A separate table would require schema parity with `products` and a merge step that knows about every column. JSONB stores only the fields the partner changed — the approve handler iterates its keys and applies them to the live columns directly. New product fields added in future migrations automatically work without touching the approval flow.

**Why gate AI generation by tokens rather than a flat rate limit?**
Token budgets give admin fine-grained control per partner (a high-volume partner can be granted more; a low-trust partner stays at the default 10) without hard-coding rate limiting logic. It also makes the cost model transparent to partners — they know exactly how many generations they have left and can request more with justification.
