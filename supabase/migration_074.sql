-- Campaign Events: source of truth for holiday/event sale markdowns
-- Separate from coupon_campaigns (which are customer-specific discount emails)

CREATE TABLE IF NOT EXISTS public.campaign_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  slug               text        NOT NULL UNIQUE,
  category           text        NOT NULL,
  description        text,
  banner_message     text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  status             text        NOT NULL DEFAULT 'draft',
  campaign_type      text        NOT NULL DEFAULT 'markdown',
  discount_type      text,
  discount_value     numeric,
  coupon_code        text,
  allow_coupon_stack boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_events_status_check
    CHECK (status IN ('draft', 'active', 'ended')),
  CONSTRAINT campaign_events_discount_type_check
    CHECK (discount_type IS NULL OR discount_type IN ('fixed', 'percent')),
  CONSTRAINT campaign_events_category_check
    CHECK (category IN (
      'black_friday','cyber_monday','valentines_day','mothers_day','womens_day',
      'birthday','lunar_new_year','christmas','anniversary','flash_sale',
      'vip_access','last_chance'
    ))
);

-- Products attached to a campaign with optional per-product event pricing
CREATE TABLE IF NOT EXISTS public.campaign_event_products (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid        NOT NULL REFERENCES public.campaign_events(id) ON DELETE CASCADE,
  product_id           uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_price_usd      numeric,
  sort_order           integer     NOT NULL DEFAULT 0,
  is_featured_for_email boolean   NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS campaign_events_slug_idx      ON public.campaign_events(slug);
CREATE INDEX IF NOT EXISTS campaign_events_status_idx    ON public.campaign_events(status);
CREATE INDEX IF NOT EXISTS campaign_events_coupon_idx    ON public.campaign_events(coupon_code) WHERE coupon_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_ep_campaign_idx      ON public.campaign_event_products(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_ep_product_idx       ON public.campaign_event_products(product_id);

-- Auto-update updated_at on campaign_events
CREATE OR REPLACE FUNCTION public.set_campaign_events_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_events_updated_at ON public.campaign_events;
CREATE TRIGGER campaign_events_updated_at
  BEFORE UPDATE ON public.campaign_events
  FOR EACH ROW EXECUTE FUNCTION public.set_campaign_events_updated_at();
