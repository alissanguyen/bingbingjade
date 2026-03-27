-- migration_030: discount + referral + email marketing system
-- Run this migration in the Supabase SQL editor.

-- ── 1. Email subscribers (pre-customer newsletter signups) ──────────────────
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                         text NOT NULL UNIQUE,  -- normalized (lowercase, trimmed)
  subscribed_at                 timestamptz NOT NULL DEFAULT now(),
  welcome_discount_redeemed_at  timestamptz,           -- set when they use the welcome discount
  source                        text NOT NULL DEFAULT 'website',
  created_at                    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Extend customers with marketing + referral + credit fields ───────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS marketing_opt_in             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at          timestamptz,
  ADD COLUMN IF NOT EXISTS first_paid_order_at          timestamptz,
  ADD COLUMN IF NOT EXISTS first_delivered_order_at     timestamptz,
  ADD COLUMN IF NOT EXISTS paid_order_count             integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code                text UNIQUE,
  ADD COLUMN IF NOT EXISTS store_credit_balance         numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS welcome_discount_redeemed_at timestamptz;

-- ── 3. Campaign / seasonal coupons ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_campaigns (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        text NOT NULL UNIQUE,          -- uppercase enforced in app
  name                        text NOT NULL,
  discount_type               text NOT NULL CHECK (discount_type IN ('fixed', 'percent', 'tiered')),
  discount_value              numeric(10,2),                 -- NULL for tiered
  active                      boolean NOT NULL DEFAULT true,
  starts_at                   timestamptz,
  ends_at                     timestamptz,
  new_customers_only          boolean NOT NULL DEFAULT false,
  minimum_order_amount        numeric(10,2),                 -- optional floor
  max_redemptions_per_customer integer NOT NULL DEFAULT 1,
  max_total_redemptions       integer,                       -- optional global cap; NULL = unlimited
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Coupon redemptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES public.coupon_campaigns(id),
  customer_email        text NOT NULL,                       -- normalized
  customer_id           uuid REFERENCES public.customers(id),
  order_id              uuid REFERENCES public.orders(id),
  discount_amount_cents integer NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  redeemed_at           timestamptz NOT NULL DEFAULT now()
);
-- Prevent a second pending/confirmed redemption for the same campaign+email.
-- Enforced in code; unique index provides last-resort DB protection.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_active
  ON public.coupon_redemptions (campaign_id, customer_email)
  WHERE status != 'cancelled';

-- ── 5. Referrals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id    uuid NOT NULL REFERENCES public.customers(id),
  referral_code           text NOT NULL,
  referred_customer_email text NOT NULL,                     -- normalized
  referred_order_id       uuid REFERENCES public.orders(id),
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'qualified', 'rewarded', 'cancelled')),
  discount_amount_cents   integer,                           -- what the referred customer saved
  credited_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  -- Prevent the same person being referred via the same code twice
  UNIQUE (referral_code, referred_customer_email)
);

-- ── 6. Store credit ledger ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  type        text NOT NULL
                CHECK (type IN ('referral_reward', 'manual_credit', 'redemption', 'reversal')),
  amount      numeric(10,2) NOT NULL,     -- positive = credit added, negative = deducted
  order_id    uuid REFERENCES public.orders(id),
  referral_id uuid REFERENCES public.referrals(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Extend orders with discount tracking ─────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_source               text
    CHECK (discount_source IN ('welcome', 'referral', 'campaign', 'store_credit')),
  ADD COLUMN IF NOT EXISTS discount_amount_cents         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_before_discount_cents integer,
  ADD COLUMN IF NOT EXISTS coupon_redemption_id          uuid REFERENCES public.coupon_redemptions(id),
  ADD COLUMN IF NOT EXISTS referral_id                   uuid REFERENCES public.referrals(id);

-- ── 8. Indexes for performance ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email         ON public.email_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_customers_referral_code         ON public.customers (referral_code);
CREATE INDEX IF NOT EXISTS idx_customers_email_opt_in          ON public.customers (customer_email, marketing_opt_in);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code         ON public.referrals (referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_order        ON public.referrals (referred_order_id);
CREATE INDEX IF NOT EXISTS idx_store_credit_customer           ON public.store_credit_ledger (customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order        ON public.coupon_redemptions (order_id);
