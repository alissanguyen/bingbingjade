# BingBing Jade Rules

## Tech Stack
- Next.js App Router
- TypeScript
- Supabase Postgres and Storage
- Stripe Checkout, Tax, and Webhooks
- Resend transactional email
- Sanity CMS
- Vercel deployment
- Tailwind CSS

## Critical
- Never break Stripe checkout, webhook idempotency, tax, shipping, discount, or inventory marking flows.
- Never expose private bucket originals or server-only cost fields to client components or public APIs.
- Preserve watermark processing logic and storage path normalization.
- Preserve campaign event pricing, coupon stacking rules, and server-side event price resolution.
- Preserve product option pricing logic; option prices must not be clobbered by parent product sale prices.
- Keep discount validation server-side; never trust client-reported discount amounts.
- Keep high-value price hiding/consultation behavior intact.
- Do not revert existing uncommitted user changes.

## Performance
- Prefer ISR/revalidate for public pages where possible; use `force-dynamic` only when live data correctness requires it.
- Avoid client-side fetching of large datasets.
- Use pagination or scoped queries for product, order, customer, subscriber, and accounting lists.
- Resolve image URLs deliberately; avoid storing expiring signed image URLs in the database.
- Use Supabase image transforms or appropriately sized images for cards, carousels, search, and cart thumbnails.

## Style
- Maintain the luxury ecommerce aesthetic: restrained, polished, jade-forward, and trust-focused.
- Build mobile-first and verify compact layouts for product, cart, checkout, and admin flows.
- Preserve existing UI patterns unless explicitly instructed to redesign.
- Keep admin surfaces dense, practical, and workflow-oriented.
- Avoid decorative redesigns that reduce clarity or slow common operations.

## Testing
- Run targeted tests for changed business logic when feasible.
- Prioritize tests around checkout, discounts, storage URL handling, sourcing classification, slugs, and metadata encoding.
- For broad shared changes, run `npm test` and `npm run lint` when practical.
