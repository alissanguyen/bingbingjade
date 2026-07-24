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

- **Product catalog** with multi-faceted filtering (category, availability status, origin, color, price range, size, clearance) and sorting (newest, price ascending/descending); multi-category URL params (e.g. `?category=ring,earring`) display combined category views from nav links
- **Product detail pages** with full image gallery (lightbox), inline video preview, variant selection (product options with per-option pricing), and add-to-cart
- **Oval bangle support** — `size` is a flexible text field (holds a single number, a range like "7.2–7.5", or "Varies") rather than a strict numeric column; oval-shaped bangles show a dedicated 4-dimension measurement layout plus wrist-size guidance instead of the standard single-diameter display
- **Persistent cart** stored in localStorage with a slide-out cart drawer
- **Zone-based international shipping** — US $20 / Canada+Europe $35 / Asia-Pacific $75 base, +$10–$20 per additional piece; shipping address collected in the storefront UI before redirecting to Stripe so customers never re-enter it; address passed to `payment_intent_data.shipping` for Stripe records
- **Stripe fee gross-up** — transaction fee is computed as `⌈(subtotal + 30) / (1 − rate)⌉ − subtotal` (domestic 2.9%, international 4.4%) so the seller nets exactly the item price after Stripe deducts their cut; displayed as a single "Transaction Fee" line with no formula exposed to customers
- **Automatic WA sales tax** — Stripe Tax (`automatic_tax: { enabled: true }`) with `tax_behavior: "exclusive"` on all line items; triggers only for Washington-state shipping addresses where business nexus is registered; WA customers see an in-cart notice before checkout
- **Shipping insurance option** — 5% of item subtotal (before discount), covers declared value; opt-in toggle in checkout
- **Expedited / Priority Sourcing toggle** in cart drawer with link to `/faq#expedited-shipping` policy
- **Discount code entry** in cart drawer — validated live against `/api/validate-discount`; supports welcome, referral, campaign, and store credit sources
- **Stripe Checkout** integration — cart contents are re-validated server-side before the Stripe session is created, preventing price manipulation; discount is re-validated server-side too; customer email collected in the checkout UI and passed to the checkout API for restriction checks and order confirmation
- **Announcement banner** (`AnnouncementBanner`) — configurable site-wide banner managed from `/admin`:
  - Presets: New Drops, Mother's Day, Valentine's Day, Black Friday, Custom
  - Supports multiple rotating messages displayed as a seamless right-to-left ticker (CSS `translateX(0→-50%)` loop over doubled content — no fade, true marquee)
  - Optional CTA button scrolls with the ticker as the last item per pass
  - Optional start/end dates; banner stays active until manually removed if no end date set
  - Per-preset theming: dark/light/auto mode, custom hex background + text + accent colors
  - `prefers-reduced-motion` support — first message shown statically; countdown mode renders a static centered layout
  - Dismiss button sits outside the overflow container; right-edge gradient mask prevents overlap
  - Config type in `lib/banner-config.ts`; stored in `site_config` table
- **Subscribe popup** — appears 2.5 seconds after first visit to homepage; localStorage-gated (shows once per browser); auto-dismisses 1.8s after successful subscription
- **Order tracking page** at `/orders/[orderNumber]` — animated timeline with staggered fade-in, ping ripple on the current step, shimmer flowing down connector lines; cancelled orders show a tailored full-width banner instead of the timeline:
  - `piece_unavailable` — warm apology, refund notice, custom sourcing CTA linking to `/custom-sourcing`
  - `customer_cancelled` — confirmation tone, refund notice, re-engagement CTA linking to `/products`
  - Wine/burgundy palette (distinct from the generic red) with variant-specific iconography and messaging
- **Hash-based accordion navigation** on `/faq` and `/policy` — clicking an accordion section updates the URL hash; sharing a hash link auto-opens and scrolls to that section
- **WhatsApp inquiry** links that auto-compose a message with product details and a deep link
- **BNPL payment messaging** — `PaymentMessaging` component shows estimated monthly payments using Afterpay (orders < $500) and Affirm, with tiered calculation (4 payments at 5% APR / 12 / 24 months depending on order size); compact one-line variant on product cards, full logo row on product detail pages; hides for inquiry-priced and sold items
- **Campaign event sale pages** — `/sale/[slug]` landing pages per campaign event (e.g. Black Friday, Mother's Day): full-bleed hero with banner message, discount badge, and product grid scoped to that event's tagged products; category-filtered tabs; draft preview mode for admin
- **Clearance section** — products flagged `is_clearance` (independent boolean from status) appear with an amber "Clearance" badge on product cards and are filterable via `?clearance=1`; clearance pricing uses `sale_price_usd` for the marked-down amount
- **Size guide** at `/size-guide` — bangle and ring measurement guides with visual diagrams
- **Jade Preservation service** at `/restoration` — inquiry form for jade bangle polishing and protective metal wrapping (silver/gold); intake collects service type, piece details, contact info, and uploads; request sent to admin via email
- **Rewards portal** at `/rewards` — no-login customer dashboard accessed via magic link emailed on request:
  - Email lookup form requests a time-limited token (15-minute TTL, 32 bytes entropy)
  - Token-authenticated dashboard shows referral code with one-click copy, store credit balance, total earned, total used, successful referral count, and pending referral count
  - Full-height split-screen layout on desktop (editorial photo + form); centered card in token mode
- **Fully responsive** design with dark mode support (next-themes)
- **SEO-optimised** product pages with dynamic `<meta>` tags, OpenGraph images, and structured keywords

### Collections / Lookbook

A luxury editorial system for curated collections with shoppable lifestyle photography.

- **Collection pages** at `/collections/[slug]` — each collection has a full-bleed hero banner (with focal-point control via CSS `object-position` driven by per-collection `hero_focal_x/y` percentages; separate mobile focal points), an optional description, and a customisable hero banner image or a selected scene image as the banner
- **Editorial section** — a `CollectionStory` component sits between the description and the lifestyle grid: deep navy (dark mode) / warm stone (light mode) full-width section with serif heading, luxury-editorial body copy, staggered `IntersectionObserver` fade-in animations, and gradient fades top and bottom. Reusable with optional `title`, `paragraphs`, and `footer` props for per-collection customisation
- **Lifestyle photo gallery** — CSS masonry grid (`columns-1/2/3`) of scenes; each scene is an `<picture>` element with a desktop image and optional mobile-specific image
- **Shoppable scene tags** — circular dot overlays positioned by percentage coordinates on each scene image; hover (desktop) or tap (mobile) opens a product card:
  - Desktop: absolute edge-aware popup card (`w-52`) that flips left/right and up/down based on tag position relative to the 60%/65% thresholds; 200ms hover debounce keeps the card open while moving between dot and card
  - Mobile: fixed-to-viewport bottom overlay card (`w-56`, `z-[9999]`) rendered at the `CollectionScene` level rather than inside the `TagDot`'s CSS `transform` container — avoids the browser rule that `position: fixed` inside a `transform` ancestor anchors to that ancestor instead of the viewport; close × button + Escape key dismissal
  - Separate mobile coordinate overrides (`mobile_x`, `mobile_y`) allow repositioning dots for the mobile image crop
- **Product grid ("Shop the Collection")** — responsive card grid with sale badge overlay (red "Sale" + amber `−N%` pill on image top-left), sold badge, category + tier row, product name, amber sale price with original struck-through, and size · origin in the price row; sold products dim the info section but retain pricing for reference
- **Admin CMS** at `/collections-admin` — create/edit/delete collections; manage scenes (upload desktop + mobile images, set captions, reorder); tag products onto scenes with drag-to-position dot placement; assign products to the "Shop the Collection" grid; set hero image / hero scene; control focal points

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
- **Edit product** — same full-featured form, pre-populated with existing data; includes lightbox for existing images and inline video preview; pending images (pre-background-processing) are also uploaded and saved when the form is submitted
- **Draft/publish workflow** — products default to draft and are hidden from the storefront until explicitly published; `published_at` timestamp set only on first publish
- **Product status values** — `available`, `on_sale`, `sold`, `archived`; `is_clearance` boolean is independent from status and can coexist with any status
- **Bulk operations** — select multiple products to batch-update status (available / on sale / sold) or bulk delete
- **Order management** — admin panel at `/orders-admin` lists all orders sorted by order number descending; two-column amount display separates "Items" (sum of `order_items.price_usd × quantity`) from "Total" (full `amount_total` including shipping/fees/tax); search, status filtering, Ship Now / Sourced for You fulfillment-type filter pills, and pagination; each order has a full detail/edit page supporting:
  - Status updates with optional email notification to customer; changing status to `order_cancelled` opens a mandatory reason picker modal — `piece_unavailable` or `customer_cancelled` — stored on the order and used to render the correct cancellation state on the tracking page
  - Estimated delivery date (triggers automatic delivery-date email)
  - Inline editing of order items (price, quantity) with auto-recalculated total; each item image links through to the live product page
  - Shipping address edit (create or update linked `customer_addresses` record)
  - Fee breakdown editor (shipping, tax, PayPal, BNPL installment fee, insurance, discount, custom line); store credit applied vs. amount actually charged through Stripe shown separately when relevant
  - Customer info edit (name, email, phone, order number, order date)
  - Notes field
  - Mark-as-paid / mark-as-refunded controls for manually-tracked (non-Stripe) orders; Stripe-dashboard-issued refunds sync in automatically via webhook
  - Delete order (admin-only, for genuine data-entry mistakes)
  - Close/reopen the post-delivery review window on a per-order basis
- **Accounting dashboard** (`/accounting-admin`) — financial reporting page with:
  - **KPI cards** — Total Collected (all payments including shipping/fees/tax), Item Revenue (jade product prices only), COGS, and Gross Profit with margin %
  - **Pure SVG bar chart** — no chart library dependencies; dual-series (emerald for revenue, rose for COGS) with year filter; overflow-scroll on mobile
  - **Annual summary table** — Total Collected / Item Revenue / COGS / Gross Profit / Margin % per year
  - **By payment source breakdown** — horizontal progress bars showing revenue split across Stripe, PayPal, Cash, Zelle, Wire, Manual
  - **COGS tracking** — `imported_price_vnd` captured at webhook time (frozen to the price at time of sale), converted at a fixed 1 USD = 26,000 VND rate, stored as `cogs_cents` on the order; profit columns gracefully hidden for orders without COGS data (`hasCogs` flag)
- **Full detailed accounting** (`/full-detailed-accounting`) — expanded P&L dashboard built on a dedicated schema:
  - `order_payments` universal ledger anchors all payment methods (Stripe, PayPal, Zelle, bank, cash, other) to BBJ order codes
  - `product_costs` tracks per-product import cost; `order_fulfillment_costs` tracks per-order variable costs (shipping, packaging, label)
  - `business_expenses` for fixed overhead
  - `accounting_summaries` cached pre-computed P&L per month/quarter/year; a "Recalculate" button in the admin triggers a fresh aggregation
  - `accounting_settings` — single-row config for default supplies cost estimate method
- **Custom order entry** — admin can create manual orders (Cash/Zelle/PayPal/Stripe/Wire Transfer source); order numbers prefixed `BBJ-` with a minimum value enforced; customer and address records created or linked automatically
- **Vendor management** — CRUD for supplier records
- **Campaign Events** (`/campaigns-admin`) — named sale events (Black Friday, Mother's Day, etc.) with:
  - Category, description, banner message, date range, status (draft / active / ended)
  - Optional discount type (fixed / percent) and amount applied to event-tagged products
  - Products explicitly tagged to an event via `campaign_event_products` join table
  - Event pricing takes priority over `sale_price_usd` on the product listing; `Sale` badge replaced with the campaign name badge (emerald) on product cards
  - Public landing page at `/sale/[slug]` with full-bleed hero, discount callout, and product grid with category tabs; admin-only draft preview mode
- **Collections admin** (`/collections-admin`) — full CMS for the lookbook/collections system (see Collections section above)
- **Item Origin Lookup** (`/item-origin-lookup`) — admin tool to retrieve original (pre-watermark) vendor images for any product by 8-digit SKU:
  - Looks up `product_original_images` by SKU; generates signed URLs (1-hour TTL) for each original
  - Displays vendor name, platform, and contact alongside product metadata
  - Individual delete (removes from DB + storage) and **bulk delete** — checkbox-select multiple images, single `DELETE ?ids=...` request removes all from both DB and Supabase storage
  - Originals are stored in a separate private bucket path (`originals/`) during the upload pipeline; vendor provenance snapshot stored in `product_originals` at upload time
- **Coupon campaign management** (`/coupons-admin`) — create seasonal/promotional codes with configurable discount type (fixed, percent, or tiered $10/$20), active date window, minimum order amount, per-customer and global redemption caps, and new-customer restriction; toggle active/inactive; live redemption count per campaign
- **Subscriber management** (`/subscribers-admin`) — view all email subscribers with their coupon code, expiry, and status (Active / Used / Expired / No code); filter tabs; resend welcome coupon email to individual subscriber; bulk email with custom subject and message body targeting all or unused-coupon subscribers; backfill coupon codes for pre-migration subscribers
- **Admin profile** (`/profile`) — at-a-glance action items: pending product approvals and pending partner token requests with inline approve/deny and adjustable grant amount
- **Beta checkout mode** — checkout locked to admin during soft-launch; toggle to public with `NEXT_PUBLIC_CHECKOUT_MODE=live`

### Livestream Selling (Instagram / TikTok)

A full workflow for running "claim it live" style sales during an Instagram or TikTok livestream, at `/livestreams-admin`.

- Admin pre-loads a livestream with numbered items (auto-coded `A1`, `A2`, … by a configurable letter prefix), each linked to an existing product with an asking price and an optional price floor
- During the live, admin marks an item claimed by a buyer's handle and sends a **private, time-limited Stripe checkout link** (24-hour expiry) via DM — the underlying product is atomically set to `reserved` with an expiry timestamp so it can't be claimed or sold elsewhere in the meantime
- Customers pay through a dedicated `/livestream-checkout/[token]` page (opaque token, not the raw Stripe URL) with `/livestream-checkout/expired` and `/livestream-checkout/invalid` fallback states
- Full event log per item (`claimed` / `checkout_sent` / `released` / `paid` / `passed` / `cancelled`) plus a **backup-buyer queue** — if the first claimant doesn't pay in time, admin can offer the item to the next person in line without losing track of who asked first
- Checkout price can differ from the announced asking price (e.g. live negotiation) with a required override note for the record
- Orders from this flow are tagged `source: 'livestream'` and appear in the normal `/orders-admin` list alongside every other channel

### Reserved Listings & Deposit Reservations

Lets an admin hold a specific one-of-a-kind piece for a specific customer, gated by a code, with an optional deposit.

- Admin creates a reservation from the product record: recipient name/email/note, deposit amount, and an expiry
- The reservation code is **never stored in plaintext** — only its SHA-256 hash — and is shared with the customer out of band (DM, email, text)
- The product page shows a "Reserved" state with a code-entry unlock panel; only a correct code reveals the checkout flow for that customer
- Admin can optionally generate a real Stripe checkout link for the deposit; once paid, the deposit amount is credited against the item's final price at checkout (applied as a coupon reduction — the fee is still calculated on the pre-deposit subtotal so the deposit never distorts the transaction fee)
- Only one active (non-cancelled) reservation is allowed per product, enforced at the database level

### Inventory Batch Tracking

Replaces flat per-product COGS entry with proper batch-level inventory accounting, at `/inventory-batches`.

- Admin creates a batch representing one sourcing trip/shipment/partner order — tracks total batch cost, partner payments (money a sourcing partner contributes to or draws from the batch), item count, and per-item expenses (e.g. absorbed shipping)
- Products are linked to the batch they came from; average cost per item, revenue booked so far, and **% sold** are computed live from linked product statuses
- Batch summary cards surface a "missing items" banner when a batch's declared item count doesn't match how many products have actually been linked — catches sourcing/data-entry gaps early
- Feeds the accounting dashboards' COGS figures in place of the older flat `imported_price_vnd`-only approach for batch-tracked products

### Customer Reviews

- Customers can submit a review (rating, description, optional photo) tied to a delivered order; the post-delivery review window can be closed per-order from the admin order detail page once no longer wanted
- **Photo uploads go through an approval gate** — new reviews (and any photo) default to unapproved and are invisible on the public storefront until an admin approves them from `/reviews-admin` (All / Pending / Approved tabs)
- Admin review photo upload includes a crop step (fixed square aspect ratio) before saving
- Public display via `ReviewsCarousel` — responsive card grid (2/3/4 columns by viewport width, driven by inline style rather than CSS breakpoints to avoid rem-based drift), customer shown by initials rather than full name, click-to-expand modal for the full review and photo

### Business Expense Tracking

Part of `/full-detailed-accounting`, for fixed overhead separate from per-product COGS.

- **Vendor and payment-method autocomplete** — `expense_vendors` / `expense_payment_methods` lookup tables (separate from jade-sourcing vendors) are seeded from existing expense history and suggested as you type, so spend keeps rolling up under one canonical name instead of fragmenting across typos and variants
- **Summary view** grouped by vendor, payment method, and category, with CSV export
- **Manage panel** — merge two vendor/method entries into one (re-points all existing expense rows) or delete an unused one

### Customer Restriction System

A server-side fraud prevention layer that screens customers at checkout based on multiple identity signals.

- **Admin UI** at `/restricted-customers` — create, edit, and deactivate restriction records; each record stores email, phone, name, address fields, reason (fraud / chargeback / policy violation / manual admin review), severity, internal notes, and status
- **Multi-signal matching** in `lib/customer-restrictions.ts` at checkout time:
  - **Strong singles** (any single match sufficient): `customer_id`, `normalized_email`, `normalized_phone`, `full_address` fingerprint (`line1|city|postal|country`)
  - **Two-signal combinations** (both required): `name + address_line1`, `name + postal + city`, or `address_line1 + postal`
  - Signals not sufficient alone: name, city, postal, state, country
  - All inputs normalised before comparison (lowercase, strip punctuation, collapse whitespace)
- **Severity levels**:
  - `blocked` — checkout is hard-rejected with an error message; customer cannot proceed
  - `review` — checkout proceeds normally but the attempt is logged for admin visibility; useful for monitoring without disrupting orders
- **Attempt logging** — every match (blocked or review) writes a record to `blocked_checkout_attempts` with the matched signals, customer snapshot, and cart snapshot; accessible in the restriction detail panel
- Restriction check runs after cart validation, before Stripe session creation — no Stripe calls for blocked customers

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
6. **SKU assignment** — each product is assigned a unique 8-digit SKU on creation; every uploaded image is recorded in `product_original_images` tied to that SKU for vendor provenance tracking

### Payment & Order Processing

- **Server-side cart validation** — every item re-fetched from DB; sold-out items rejected before reaching Stripe
- **Server-side discount validation** — `validateDiscount()` runs at checkout time; client-reported discount amount is ignored; only the server's recomputed amount is used
- **Compact metadata encoding** — cart items serialised as `{p, o?, $}` chunked across `items_0`, `items_1`, … keys (≤500 chars/value Stripe limit)
- **Idempotent webhook handler** — `orders.stripe_session_id` UNIQUE constraint; `23505` error code handled to prevent Stripe retry loops
- **Automatic inventory update** — webhook marks purchased options sold, auto-marks parent product sold when all options are sold
- **ISR cache invalidation** — webhook triggers `/api/revalidate` to clear Next.js cache for product pages immediately
- **Manual capture (authorize-then-capture) for Sourced for You orders** — overseas one-of-a-kind pieces authorize the customer's payment method at checkout (`payment_intent_data.capture_method: "manual"`) but are not charged until an admin confirms the vendor can actually secure the piece:
  - Admin sees a **Payment** card on the order detail page with a live-countdown capture deadline (color-coded Normal / Warning `<48h` / Urgent `<24h` / Expired) and two actions: **Confirm Available & Capture Payment** or **Piece Unavailable — Release Authorization** (cancels the hold, never a refund — nothing was charged)
  - Card, Klarna, Afterpay/Clearpay, and Affirm are **all** manual-capture capable in this integration (verified end-to-end per method); each has its own real authorization window tracked on the order (card 7 days, Afterpay/Clearpay 13, Klarna 28, Affirm 30) — used for the admin deadline badge only, never to gate the actual capture/cancel decision, which always re-verifies the live Stripe PaymentIntent status first
  - Ship Now and Sourced for You items can't be mixed in one checkout — `capture_method` is set once per PaymentIntent, so a cart can't auto-capture some items while holding others; blocked client- and server-side with a clear explanation
  - Fulfillment (shipment creation, inventory sold-marking follow-through, order-confirmation email) is deferred until capture; releasing an authorization restores the linked product to `available`
  - Idempotent throughout: admin capture/release routes use an atomic conditional DB update plus a Stripe `idempotencyKey`; a `payment_intent.succeeded`/`payment_intent.canceled` webhook reconciliation path catches the rare case where the admin route's own write didn't land
- **Shipping insurance acknowledgement** — customers must either opt in or explicitly acknowledge declining insurance before checkout submits; silently proceeding without a choice is blocked client-side with a scroll-to-and-highlight prompt; both states are persisted on the order (`shipping_insurance_accepted` / `shipping_insurance_declined_acknowledged`)

### Discount & Referral System

A production-hardened discount engine with no stacking (exactly one discount source per order) and full abuse prevention. All validation is server-side — the client is never trusted for discount amounts.

**Sources (priority order):**

| Priority | Source | Amount | Eligibility |
|---|---|---|---|
| 1 | Explicit code → referral | Tiered ($10/$20) | New customers only, no self-referral, no duplicate |
| 2 | Explicit code → subscriber welcome coupon | Tiered ($10/$20) | Code tied to subscriber email, 30-day expiry, first order only |
| 3 | Explicit code → campaign | Configurable | Per campaign rules |
| 4 | Store credit — legacy auto-applied (`store_credit_ledger`) | Full balance (capped at subtotal) | Any customer with a positive balance, matched by email |
| 5 | Welcome (auto, legacy) | Tiered ($10/$20) | Pre-migration subscribers without a code |

**Tiered discount:** subtotal ≥ $150 → $20 off; subtotal < $150 → $10 off. Computed server-side at checkout time so cart-size manipulation cannot lock in the higher tier.

**Welcome coupon codes:**
- Each new subscriber receives a unique 6-digit numeric code (100000–999999) via the welcome email
- Code is cryptographically generated (`crypto.randomInt`), stored with a 30-day expiry in `email_subscribers`
- Validated by matching code to subscriber email — prevents sharing between accounts
- Collision-safe: up to 10 retry attempts on duplicate code generation
- **Abuse prevention:** after redemption, a shipping fingerprint (`phone|city|postal|country`) is stored on the subscriber record; duplicate fingerprints on separate redeemed coupons emit a server-side warning log; order still completes (no silent blocking)
- Backward compat: subscribers without a code (pre-migration) still receive auto-applied welcome discount; admin can generate codes for them via "Backfill Coupons" in `/subscribers-admin`
- **Soft-delete on unsubscribe** — unsubscribing sets `unsubscribed_at` rather than deleting the row; prevents a user from re-subscribing with the same email to receive a fresh coupon code
- **Per-recipient unsubscribe tokens** — each subscriber record has a `uuid` token used in email footers; unsubscribe links use this token rather than a base64-encoded email

**Referral program:**
- After a customer's first delivered order, they receive a referral code and an invite email
- Referred friend gets tiered discount on their first order
- Referrer earns $10 store credit when the referred friend's order is delivered (idempotent — reward issued exactly once, checked by referral status field)
- Self-referral and duplicate referral use are blocked server-side

**Campaign coupons:** `coupon_campaigns` table supports fixed/percent/tiered discount types, active date windows, new-customer restrictions, per-customer and global redemption caps. Created and managed from `/coupons-admin`.

**Personal customer coupons:** admin can issue one-time coupons to specific customers from `/coupons-admin` → "Customer Coupon":
- Customer field is a live search combobox (debounced, searches by name or email via `/api/admin/customers`)
- Purpose: "Thank You Note" or "Retention Encourage" — each generates distinct email copy
- Auto 3-month validity — `ends_at` is always set to 90 days from creation; no manual expiry input
- Optional scheduled send — leave blank to send immediately, or pick a future datetime; a Vercel cron job picks up pending sends hourly
- **Automatic reminder emails** — sent at 30 days ("still waiting", green) and 60 days ("expires soon", amber warning) after the original send, only if the coupon hasn't been redeemed and is still valid; tracked via `reminder1_sent_at` / `reminder2_sent_at` columns

**Giveaway coupons:** admin can issue never-expiring single-use coupons to anyone (including non-clients) from `/coupons-admin` → "Giveaway":
- Free-text recipient email — no customer search required; works for contest winners, influencers, or anyone not yet in the system
- Optional recipient name for internal labelling
- `never_expires: true` flag bypasses the 3-month auto-expiry that normally applies to customer coupons; `ends_at` is stored as `null`
- Sends the thank-you coupon email immediately on creation
- Shown with an amber "Giveaway" badge in the campaign table (distinguished from "Thank You" by `ends_at IS NULL`)

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

### Store Credit (Admin-Issued, Code-Redeemed)

A second, distinct store-credit system — separate tables, separate admin surface, and deliberately **not** the same mechanism as the legacy auto-applied `store_credit_ledger` balance above. Built for goodwill resolutions, cancellations, damaged/lost packages, returns, price adjustments, and VIP/loyalty credit, where an admin needs to issue a specific amount with specific conditions against a specific customer, redeemed by code rather than by email match alone.

- **Admin issuance** — `/store-credits-admin`, or an "Issue Store Credit" button directly on any order's detail page (pre-fills customer email, name, order number, currency). Required: amount, customer email, reason. Optional conditions: expiration date, valid-starting date, minimum merchandise subtotal, max line items in cart (`= 1` for single-item-only), Ship Now / Sourced for You / either, eligible or excluded products, sale/clearance exclusion, discount-code and other-store-credit stacking rules, single-use vs. reusable-until-zero, max $ or % of order per redemption
- **One shared condition formatter** — `getStoreCreditDisplayConditions()` generates the plain-English condition list from the structured fields; used identically by the admin issuance preview, the customer email, and checkout display, so wording can never drift between what's promised and what's enforced
- **Email preview** — both the issuance form (from in-progress draft fields, before the credit even exists) and the credit's detail page (for an already-issued credit) can render the exact email HTML a customer would receive, via a shared `buildStoreCreditEmailHtml()` builder
- **Checkout redemption** — a separate "Store credit code" field from the discount-code field; validated live, then fully re-validated server-side against current DB state (never trusts client-echoed amounts); reduces only the final amount sent to Stripe — merchandise subtotal, promotional discounts, shipping, insurance, and tax are computed exactly as normal and are unaffected by store credit
- **Concurrency-safe redemption** — a Postgres RPC function (`reserve_store_credit`, using `SELECT ... FOR UPDATE`) reserves the balance atomically at checkout-session creation, converts to a redemption on order completion, and releases automatically if the checkout session expires or fails — two simultaneous checkouts can't both spend the same balance
- **Orders fully covered by credit skip Stripe entirely** — no $0 PaymentIntent; the order is created through the same shared order-finalization path the webhook uses, just without a Stripe session
- **Refunds/cancellations restore credit before touching Stripe** — a goodwill credit can never be converted into a cash refund; only the amount actually charged through Stripe is ever refunded through Stripe
- **Full audit trail** — every issuance, reservation, redemption, release, restoration, admin adjustment, and revocation is an immutable row in `store_credit_transactions`; the cached balance on `store_credits` is always reconcilable by replaying the ledger
- **Admin management** — search/filter by email, code, order number, or reason; view full transaction history; resend the notification email; extend or remove expiration; increase/decrease balance with a required reason; revoke unused credit; transfer to another email with a required reason; export credits and the full ledger to CSV

**Note on the legacy system:** `store_credit_ledger` / `customers.store_credit_balance` (earned via referral rewards, auto-applied by email match, no code or conditions) is untouched and still earning-only — the reasoning below about unauthenticated spending risk still applies to *that* system specifically. It doesn't apply to the new code-based system, since redemption there requires possession of an unguessable, securely-generated code rather than just knowledge of an email address.

### Email System (Resend)

All transactional emails use custom branded HTML templates and are BCC'd to `contact@bingbingjade.com`. Subject lines are prefixed for Gmail filter-based sorting:

| Subject prefix | Emails |
|---|---|
| `[Order Placed]` | Order confirmation |
| `[Order Update]` | Status change, delivery date update, referral invite, referral reward |
| `[Subscriber]` | Welcome newsletter email |

**Admin broadcast email templates** (all with branded hero banners — full-bleed jade background image, dark gradient overlay, emerald eyebrow + white heading):
- **New Drops** (`/custom-emails-admin/new-drops`) — 1200px wide product showcase with photo grid; hero auto-cycles through caption variants
- **Blog Announcement** (`/custom-emails-admin/new-blog`) — 1200px wide; blog thumbnail used as hero background; title displayed as large h1 in the banner
- **Order Delay** (`/custom-emails-admin/order-delays`) — 600px transactional email with jade hero banner, order number displayed in banner, "Track My Order" button linking to customer's `/orders/[orderNumber]` page; supports multi-order batch send
- **Care Tips** (`/custom-emails-admin/care-tips`) — 600px transactional email with jade hero banner "Caring Tips for Your New Piece"; sent to customers with recently delivered orders (last 90 days by `created_at`)
- **Product Showcase** (`/product-email-admin`) — admin selects from recent published products and sends a curated showcase email to all subscribers; product cards rendered with image, name, category, and price
- **Collection Drops** (`/custom-emails-admin/collection-drops`) — announces a BingBing exclusive collection; compose UI selects a collection, pulls its hero image and featured scenes, and sends to all or selected subscribers with a full-width editorial hero and scene imagery
- **Customer coupon emails** — initial send (thank you / retention copy), plus automated reminders at 30 and 60 days
- **Campaign emails** (`/custom-emails-admin/campaign`) — seasonal and promotional broadcast emails with a 4-step compose UI:
  - **Step 1 — Preset picker:** 12 presets (Black Friday, Cyber Monday, Valentine's Day, Mother's Day, Women's Day, Birthday, Lunar New Year, Christmas, Anniversary, Flash Sale, VIP, Last Chance); each auto-populates subject, headline, intro, urgency line, CTA, and banner image; all fields editable
  - **Step 2 — Content editor:** subject, headline, intro paragraph, urgency line, CTA button text + link; optional discount block (fixed $ off or % off) with discount value, optional code, and optional expiry — displayed in the email as a luxury gold-bordered offer box with serif amount and dashed code box; on send, the discount code is automatically upserted into `coupon_campaigns` (`ignoreDuplicates: true` so existing codes are not overwritten)
  - **Step 3 — Featured products (optional):** multi-select grid of available products; selected products rendered as a 2-column card grid below the hero
  - **Step 4 — Recipients:** all subscribers or a manually selected subset via `SubscriberPicker`
  - Full-width hero banner: each preset has a corresponding image from `public/campaign_banners/` (JPEG); relative paths are resolved to absolute URLs at render time; falls back to the default jade Unsplash photo if no image is set
  - Preview modal before send; per-recipient HTML rendering (personalised unsubscribe tokens)

**Unsubscribe:** `/api/unsubscribe?token=<uuid>` sets `unsubscribed_at` on the subscriber record (soft delete) and renders a confirmation page. A subtle 10px light-gray link is embedded in welcome email footers (CAN-SPAM compliant, intentionally unobtrusive). Soft-deletion preserves coupon history and prevents re-subscribe coupon abuse.

---

## Project Structure

```
jade-shop/
├── app/
│   ├── page.tsx                        # Homepage — subscribe popup + featured carousel
│   ├── products/
│   │   ├── page.tsx                    # Listing — RSC, ISR, multi-filter, event pricing
│   │   └── [slug]/page.tsx             # Detail — SSG + ISR, SEO metadata
│   ├── collections/
│   │   └── [slug]/page.tsx             # Collection/lookbook — hero, editorial, scenes, product grid
│   ├── collections-admin/
│   │   ├── page.tsx                    # Collections list
│   │   └── [id]/CollectionAdminClient.tsx  # Scene + tag + product CMS
│   ├── sale/
│   │   └── [slug]/page.tsx             # Campaign event landing page
│   ├── campaigns-admin/
│   │   └── CampaignsAdminClient.tsx    # Campaign event CRUD
│   ├── orders/[orderNumber]/
│   │   ├── page.tsx                    # Order status page (server)
│   │   └── OrderTimeline.tsx           # Animated timeline (client component)
│   ├── rewards/
│   │   ├── page.tsx                    # Magic-link rewards portal
│   │   └── RewardsClient.tsx           # Token-authenticated dashboard
│   ├── restricted-customers/
│   │   └── RestrictedCustomersClient.tsx  # Customer restriction management
│   ├── item-origin-lookup/
│   │   └── ItemOriginLookupClient.tsx  # SKU → original images + vendor lookup
│   ├── restoration/
│   │   └── RestorationClient.tsx       # Jade preservation service intake
│   ├── size-guide/page.tsx             # Bangle + ring sizing guides
│   ├── faq/page.tsx                    # FAQ — accordion with hash navigation + IDs
│   ├── policy/page.tsx                 # Policy — accordion with hash navigation + IDs
│   ├── checkout/
│   │   ├── success/page.tsx
│   │   └── cancel/page.tsx
│   ├── contact/
│   ├── orders-admin/
│   │   ├── page.tsx                    # Order list — sorted by order number, Items+Total split
│   │   ├── [id]/page.tsx               # Order detail / edit (strips cogs_cents before client)
│   │   └── new/page.tsx                # Create manual order
│   ├── accounting-admin/
│   │   ├── page.tsx                    # Server wrapper (force-dynamic)
│   │   └── AccountingClient.tsx        # KPI cards, SVG chart, annual table, source breakdown
│   ├── full-detailed-accounting/
│   │   └── AccountingDashboard.tsx     # Expanded P&L — ledger, COGS, expenses, summaries cache
│   ├── customers-admin/
│   ├── product-email-admin/
│   │   └── ProductEmailClient.tsx      # Product showcase email composer
│   ├── custom-emails-admin/
│   │   ├── page.tsx                    # Email type picker
│   │   ├── new-drops/
│   │   ├── new-blog/
│   │   ├── order-delays/
│   │   ├── care-tips/
│   │   ├── campaign/                   # 4-step campaign email composer
│   │   └── collection-drops/           # Collection announcement email
│   ├── studio/
│   │   └── [[...tool]]/page.tsx        # Sanity Studio (force-dynamic; localhost-only via middleware)
│   │
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts       # Cart + discount + restriction check → Stripe session
│   │   │   └── webhook/route.ts        # Order creation + COGS capture + inventory + discount commit
│   │   ├── admin/
│   │   │   ├── orders/route.ts         # Order list — joins order_items for item_subtotal
│   │   │   ├── orders/[id]/route.ts    # Order CRUD + email triggers + delivery flows
│   │   │   ├── accounting/route.ts     # Monthly/annual revenue, COGS, by-source aggregation
│   │   │   ├── customer-restrictions/route.ts        # List + create restrictions
│   │   │   ├── customer-restrictions/[id]/route.ts   # Get + update + delete restriction
│   │   │   ├── item-origin-lookup/route.ts            # SKU lookup + image delete (single + bulk)
│   │   │   ├── emails/collection-drops/route.ts       # Collection drop email send
│   │   │   └── ...
│   │   ├── subscribe/route.ts          # Email list signup + welcome email
│   │   ├── validate-discount/route.ts  # Read-only discount preview for cart drawer
│   │   ├── unsubscribe/route.ts        # Soft-delete unsubscribe (token param)
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
│       ├── collection/
│       │   ├── CollectionScene.tsx     # Shoppable scene: tag dots, hover/tap cards, mobile overlay
│       │   └── CollectionStory.tsx     # Luxury editorial section with IntersectionObserver fade-in
│       └── ...
│
├── lib/
│   ├── discount.ts                     # Validation, commit, referral reward, code gen
│   ├── discount-emails.ts              # Welcome, referral invite, referral reward emails
│   ├── orders.ts                       # Confirmation, status, delivery date emails; helpers
│   ├── stripe-metadata.ts              # Compact encode/decode + discount metadata
│   ├── customer-restrictions.ts        # Multi-signal restriction check + attempt logging
│   ├── active-event-prices.ts          # Resolves live campaign event pricing per product
│   ├── collection-email.ts             # Collection drop email HTML rendering
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
│   └── migration_001.sql → migration_082.sql
│
├── middleware.ts
└── next.config.ts
```

---

## Data Flows

### Checkout with Discount, Store Credit, and Manual Capture

```
Customer fills email + optional discount code + optional store-credit code in cart/checkout
  → POST /api/validate-discount (read-only preview)          — promotional discount
  → POST /api/validate-store-credit (read-only preview)      — separate field, separate system
      → validateDiscount() — checks referral, campaign, legacy auto store credit, welcome
      → validateStoreCredit() — checks code/email/dates/subtotal/fulfillment-type/
        product & collection scope/sale-clearance exclusion/stacking rules/usage caps
  → Cart displays: subtotal → discount → shipping → insurance → tax → store credit
    (store credit never affects tax/shipping/insurance — applied last, to the final total only)
  → Customer clicks Checkout → POST /api/stripe/checkout
      → Re-validate all items (price + sold status) — client amounts never trusted
      → Re-run validateDiscount() and validateStoreCredit() server-side
      → checkCustomerRestriction() — email + address matched against restrictions
          → blocked: reject with 403 and log attempt
          → review: log attempt, continue checkout
      → Build line items: items + shipping + insurance + tax + transaction fee
      → If store credit applied: reserveStoreCredit() — row-locked Postgres RPC,
        atomically decrements the cached balance and writes a 'reserved' ledger row
      → If Ship Now: capture_method defaults to automatic (charged immediately)
        If Sourced for You: payment_intent_data.capture_method = "manual"
          (mixing the two fulfillment types in one cart is blocked — one PaymentIntent
          can't auto-capture part of an order while holding the rest)
      → If store credit covers the full remaining amount: skip Stripe entirely —
        finalizeProductOrder() runs synchronously (same shared logic the webhook
        uses below), reservation is redeemed immediately, customer redirects
        straight to /checkout/success
      → Else: fold discount + store credit into one Stripe coupon (Stripe doesn't
        support negative line items), encode both into separate, non-overlapping
        session metadata keys, stripe.checkout.sessions.create(...)
  → Redirect to Stripe hosted checkout → customer pays (or authorizes, if manual capture)
  → Stripe fires checkout.session.completed
      → POST /api/stripe/webhook
          → Decode discountMeta and store-credit metadata separately
          → Prefer metadata.cust_email over Stripe-collected email
          → finalizeProductOrder() — shared with the zero-balance path above:
              → INSERT order (discount + store-credit columns tracked independently)
              → commitDiscount() — idempotent writes to coupon_redemptions/referrals
              → redeemStoreCreditReservation() if a reservation is attached
              → Create shipments + mark inventory sold (skipped if manual capture —
                deferred until an admin captures payment)
              → Send order confirmation email, or the "confirming availability"
                email instead if manual capture
          → Trigger ISR revalidation
  → (Sourced for You only) Admin later reviews the Payment card on the order:
      → Confirm Available & Capture Payment — captures the PaymentIntent, then
        runs the deferred shipment creation + confirmation email
      → Piece Unavailable — Release Authorization — cancels the PaymentIntent
        (never a refund), restores product to available, restores any store
        credit used, sends the "authorization released" email
  → checkout.session.expired (abandoned checkout) → releaseStoreCreditReservation()
    so the reserved balance doesn't stay locked with nothing to redeem it
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
| `/api/stripe/checkout` | POST | Beta: `x-admin-password` header | Validates cart + discount + restriction check, creates Stripe session |
| `/api/stripe/webhook` | POST | `Stripe-Signature` header | Handles `checkout.session.completed` |
| `/api/admin/orders/[id]` | GET | `admin_session` cookie | Fetch order details |
| `/api/admin/orders/[id]` | PATCH | `admin_session` cookie | Update order — status, delivery date, items, address, fees |
| `/api/subscribe` | POST | — | Add email to subscribers list; generate 6-digit coupon; fire welcome email |
| `/api/validate-discount` | POST | — | Preview discount (read-only); returns amount + message |
| `/api/unsubscribe` | GET | — | Soft-delete subscriber by token (`?token=<uuid>`) |
| `/api/upload-image` | POST | `admin_session` cookie | Watermark + upload product image; record in `product_original_images` |
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
| `/api/admin/customer-restrictions` | GET / POST | `admin_session` cookie | List active restrictions / create restriction |
| `/api/admin/customer-restrictions/[id]` | GET / PUT / DELETE | `admin_session` cookie | Fetch restriction + attempts / update / delete |
| `/api/admin/item-origin-lookup` | GET | `admin_session` cookie | Lookup original images + vendor by SKU; generates signed URLs |
| `/api/admin/item-origin-lookup` | DELETE | `admin_session` cookie | Delete single (`?id=`) or bulk (`?ids=id1,id2,...`) original images from DB + storage |
| `/api/admin/emails/collection-drops` | POST | `admin_session` cookie | Send collection drop announcement email to selected subscribers |

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
| 049 | Add scheduled send and reminder tracking columns to `coupon_campaigns` (`scheduled_send_at`, `reminder1_sent_at`, `reminder2_sent_at`) |
| 050 | Allow `on_sale` status on `product_options` (previously only `available` / `sold`) |
| 051 | Replace per-option `images[]` array with a single `image_index` pointer; variants reference parent product images by index rather than duplicating paths |
| 052 | Add `shipping_address_json` JSONB fallback on orders for orders without a `customer_id` |
| 053 | Rewards magic-link tokens — `reward_tokens` table with 15-minute TTL for the no-login `/rewards` portal |
| 054 | Full accounting schema: `acct_vendors`, `product_costs`, `order_fulfillment_costs`, `business_expenses`, `stripe_accounting_snapshots` |
| 055 | Add `show_price boolean` to products — controls public price visibility independently from `price_display_usd` |
| 056 | `order_payments` universal payment ledger — anchors all payment methods to BBJ order codes |
| 057 | `accounting_summaries` cache table — pre-computed P&L per month/quarter/year |
| 058 | `accounting_settings` — single-row config for supplies cost estimate method |
| 059 | Add supplies reconciliation columns to `accounting_summaries` for estimated vs. actual comparison |
| 060 | Product SKU column (unique 8-digit); `product_original_images` table — original unwatermarked images keyed by SKU |
| 061 | Backfill `product_original_images` for all existing listings from `wm/` storage paths |
| 062 | Add `vendor_id` to `product_original_images` and backfill |
| 063 | `product_originals` table — SKU → vendor mapping snapshot (denormalised `vendor_name` survives vendor record changes) |
| 064–065 | Add then corrected `label_cost_usd` to `product_costs`; remove from `total_cogs_usd` (label cost tracked separately from COGS) |
| 066 | Rename product color "purple" → "lavender" across all `color[]` arrays |
| 067 | Add `unsubscribe_token uuid` to `email_subscribers` for per-recipient unsubscribe links |
| 068 | Soft-delete unsubscribes — replace hard-delete with `unsubscribed_at` timestamp; prevents coupon re-issuance via re-subscribe |
| 069 | Add `cancellation_reason` to orders (`piece_unavailable` / `customer_cancelled`) for tracking-page variant messaging |
| 070 | Add `messages jsonb` array to `site_banners` for multi-message rotating ticker support |
| 071 | Extend `site_banners` with full banner system: rename `target_date` → `start_date`, add `end_date`, `is_active`, `theme`, `bg_color`, `text_color`, `accent_color` |
| 072 | Add `giveaway` as a valid `coupon_purpose` value |
| 073 | Add `archived` to product status constraint; add `published_at` timestamp |
| 074 | `campaign_events` table — named sale events with category, date range, discount type/amount, status; `campaign_event_products` join table |
| 075 | Add `countdown_label` to `site_banners` (`Starting in` / `Ends in`) for countdown mode |
| 076 | Add `campaign_event` to `orders.discount_source` allowed values |
| 077 | Collections system: `collections`, `collection_scenes`, `collection_scene_tags`, `collection_products` tables |
| 078 | Add `mobile_x` / `mobile_y` position overrides to `collection_scene_tags` for mobile image crops |
| 079 | Convert `is_clearance` from a `status` value to an independent boolean flag on products |
| 080 | Add `hero_scene_id` to `collections` — allows selecting an existing scene as the hero banner |
| 081 | Add hero focal point columns to `collections` (`hero_focal_x/y`, `hero_mobile_focal_x/y`, `hero_crop_*`) for CSS `object-position` control |
| 082 | Customer restriction system: `customer_restrictions` table (email, phone, address, severity, reason, status); `blocked_checkout_attempts` table |
| 083 | Inventory batch tracking: `inventory_batches`, `inventory_batch_items`; order-level inventory expense columns replacing flat COGS entry |
| 084 | Review photo approval workflow: `reviews.is_approved` (default false, admin must approve); `review_images` table |
| 085 | Make `reviews.order_id` nullable; seed hardcoded historical testimonials |
| 086 | Add partner payment tracking (`partner_payment_usd`) to `inventory_batches` |
| 087 | Simplify review images: `reviews.image_path` single column, drop `review_images` table |
| 088 | Add `item_expense_usd` to `inventory_batch_items` — per-product expense (e.g. absorbed shipping) tracked separately from batch cost |
| 089 | Add `item_count` to `inventory_batches` for average-cost calculation |
| 090 | Expense vendor/payment-method lookup tables (`expense_vendors`, `expense_payment_methods`) — autocomplete + merge support, separate from jade-sourcing vendors |
| 091 | Add `renewed_at` to products — lets a listing be "bumped" to appear first in sort order without changing `created_at` |
| 092 | Backfill missing shipments + shipment events for manual (Zelle/cash/admin) orders created before the shipment system existed |
| 093 | Add `receipt_storage_path` to `product_costs` — attach a receipt/invoice file to a cost record |
| 094 | Flexible size field (`products.size` → `text`, holds ranges/"Varies") + oval bangle support: `is_oval` boolean, `wrist_size`, 4-dimension measurement columns |
| 095 | Livestream selling workflow: `'reserved'` product status, `'livestream'` order source; `livestreams`, `livestream_items`, `livestream_item_events`, `livestream_backup_buyers` tables |
| 096 | Add generated column `effective_date = COALESCE(renewed_at, created_at)` for single-`ORDER BY` chronological sort across renewed and new listings |
| 097 | Product reservation system: `product_reservations` — SHA-256-hashed code, deposit tracking, one active reservation per product enforced by a partial unique index |
| 098 | Add `shipping_insurance_accepted` / `shipping_insurance_declined_acknowledged` to orders — persists the customer's explicit choice |
| 099 | Add `review_window_closed` to orders — admin can end a delivered order's review eligibility early |
| 100 | Manual capture (authorize-then-capture) support for Sourced for You orders: `capture_status` and related timestamps on orders, new order-status value `awaiting_vendor_confirmation` |
| 101 | Track which payment method (card/Klarna/Afterpay/Affirm) was used for a manual-capture authorization, so the real per-method authorization window can be shown instead of a guess |
| 102 | Store credit system (admin-issued, code-redeemed, conditional credits): `store_credits`, `store_credit_transactions` tables; row-locked Postgres RPC functions for atomic reserve/release/redeem/restore/adjust; `store_credit_id`, `store_credit_used_cents`, `merchandise_subtotal_cents`, `stripe_amount_cents` on orders |

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

**Why is the legacy referral-reward store credit (`store_credit_ledger`) still earning-only?**
Without a session-based auth system, any email-based claim at checkout is unauthenticated — an attacker who knows a customer's email could claim their store credit. Earning is fully implemented (referral reward → `store_credit_ledger`). Spending that balance at checkout would require the customer to be logged in (verified identity), which is deferred to when account creation is added. This constraint is specific to *that* system's email-only matching — it's why the newer admin-issued store credit (see Store Credit section above) was built as a **separate, code-based** system instead of extending this one: possession of an unguessable code is its own authentication, so it can be safely spent today without waiting on account login.

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

**Why use two severity levels (blocked vs. review) for customer restrictions rather than a single block?**
Hard-blocking every flagged customer risks false positives — a suspicious address pattern could match a legitimate repeat buyer. Review-severity lets the admin monitor a customer's activity (all attempts are logged) without refusing their order. Only confirmed bad actors get the `blocked` flag. This mirrors fraud tooling patterns: flag first, block after evidence accumulates.

**Why render the mobile collection tag card at the `CollectionScene` level instead of inside `TagDot`?**
The `TagDot` wrapper applies `transform: translate(-50%, -50%)` to centre the dot on its coordinates. CSS specifies that `position: fixed` inside any element with a `transform`, `filter`, or `will-change` property creates a new containing block — so a `fixed` card inside `TagDot` anchors to the dot rather than the viewport, causing it to appear clipped at the tag position. Moving the overlay rendering to the parent `CollectionScene` figure (which has no transform) means `position: fixed` resolves to the viewport correctly, producing the intended bottom-of-screen overlay on mobile.

**Why soft-delete unsubscribes instead of hard-deleting the row?**
Hard-deleting allowed a user to re-subscribe with the same email and receive a fresh welcome coupon code, bypassing the single-use intent. Soft-deletion (`unsubscribed_at` timestamp) preserves the subscriber record and coupon history. The subscription API checks for an existing row (including soft-deleted ones) before generating a new code, so re-subscribers do not receive a second coupon.
