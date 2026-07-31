-- ============================================================
-- migration_117: Generalized Service Request platform
--
-- Introduces a service catalog (`services`) and a generic workflow
-- record (`service_requests` + `service_request_attachments`) so that
-- "Restoration & Preservation" (and any future service line) is driven
-- by configuration rather than bespoke code per service.
--
-- Reuses existing generic infrastructure rather than duplicating it:
--   - audit_logs (migration_111) for the status/action timeline —
--     entity_type = 'service_request'.
--   - The capture_status vocabulary introduced for orders in
--     migration_100, so admins reviewing authorization holds see the
--     same states they already know from the orders/Sourced-for-You flow.
--
-- Additive only — does not touch orders/order_items/products.
-- ============================================================

-- ── Human-friendly request number sequence (mirrors next_order_number) ──
CREATE SEQUENCE IF NOT EXISTS public.service_request_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.next_service_request_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'SR-' || nextval('public.service_request_number_seq')::text;
$$;

-- ── Service catalog ──────────────────────────────────────────────────
-- Each row fully describes one service's workflow. Adding a fifth
-- service (e.g. "Ring Resizing") should only ever require an INSERT
-- here plus its own product copy — never a code change to the request/
-- checkout/webhook pipeline below.
CREATE TABLE IF NOT EXISTS public.services (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        text        NOT NULL UNIQUE,
  name                        text        NOT NULL,
  description                 text,
  category                    text        NOT NULL DEFAULT 'restoration_preservation',

  base_price_cents            integer,               -- NULL when quote_required
  discounted_price_cents      integer,               -- NULL when no discount tier exists
  currency                    text        NOT NULL DEFAULT 'usd',
  estimated_timeline          text,
  discounted_timeline         text,

  workflow_mode               text        NOT NULL
    CHECK (workflow_mode IN ('instant_purchase', 'authorization_hold', 'quote_required')),

  requires_image_review       boolean     NOT NULL DEFAULT true,
  min_images                  integer     NOT NULL DEFAULT 1,
  max_images                  integer     NOT NULL DEFAULT 5,
  additional_images_limit     integer     NOT NULL DEFAULT 5,

  requires_customer_verification boolean  NOT NULL DEFAULT false,
  requires_shipping           boolean     NOT NULL DEFAULT true,
  requires_return_shipping    boolean     NOT NULL DEFAULT true,

  active                      boolean     NOT NULL DEFAULT true,
  sort_order                  integer     NOT NULL DEFAULT 0,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON public.services USING (false) WITH CHECK (false);

-- ── Service requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_requests (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number              text        UNIQUE,
  public_token                text        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,   -- capability secret for the customer tracker link
  service_id                  uuid        NOT NULL REFERENCES public.services (id),

  status                      text        NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_review',
      'awaiting_images',
      'quote_needed',
      'quote_sent',
      'awaiting_approval',
      'authorization_pending',
      'authorized',
      'approved',
      'rejected',
      'awaiting_shipment',
      'received',
      'in_progress',
      'quality_control',
      'ready_to_return',
      'shipped_back',
      'completed',
      'cancelled',
      'refunded'
    )),

  -- Customer & verification
  client_type                 text        CHECK (client_type IN ('new', 'existing_client')),
  verified                    boolean     NOT NULL DEFAULT false,
  verification_order_number   text,
  customer_id                 uuid        REFERENCES public.customers (id),
  customer_name                text,
  customer_email               text,
  customer_phone                text,
  notes                       text,                  -- customer-submitted notes/concerns
  admin_instructions          text,                  -- set by "Request More Images"

  -- Pricing
  price_cents                 integer,                -- resolved at submit time
  currency                    text        NOT NULL DEFAULT 'usd',

  -- Stripe / payment
  stripe_session_id           text        UNIQUE,
  stripe_payment_intent_id    text        UNIQUE,
  capture_status               text
    CHECK (capture_status IN (
      'authorization_pending',
      'authorized',
      'captured',
      'authorization_canceled',
      'authorization_expired',
      'capture_failed',
      'payment_failed',
      'refunded',
      'partially_refunded'
    )),
  authorized_amount            integer,
  captured_amount               integer,
  authorized_at                 timestamptz,
  authorization_expires_at      timestamptz,
  captured_at                    timestamptz,
  authorization_canceled_at      timestamptz,
  latest_stripe_status            text,
  capture_payment_method           text,

  -- Quote (silver/gold wrapping and any future quote_required service)
  quote_amount_cents            integer,
  quote_notes                   text,
  quote_sent_at                  timestamptz,
  quote_expires_at                timestamptz,
  quote_accepted_at                timestamptz,

  -- Shipping / tracking
  tracking_number               text,
  carrier                        text,
  return_tracking_number          text,
  return_carrier                   text,

  -- Ops
  assigned_staff                 text,        -- free text for Phase 1; a real role/assignment system is a roadmap item
  admin_notes                     text,
  decline_reason                   text,

  submitted_at                    timestamptz,
  decided_at                       timestamptz,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_requests_status_idx ON public.service_requests (status);
CREATE INDEX IF NOT EXISTS service_requests_service_id_idx ON public.service_requests (service_id);
CREATE INDEX IF NOT EXISTS service_requests_public_token_idx ON public.service_requests (public_token);
CREATE INDEX IF NOT EXISTS service_requests_customer_email_idx ON public.service_requests (customer_email);
CREATE INDEX IF NOT EXISTS service_requests_created_at_idx ON public.service_requests (created_at);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON public.service_requests USING (false) WITH CHECK (false);

-- ── Attachments (generalized — supports images, video, and documents) ──
CREATE TABLE IF NOT EXISTS public.service_request_attachments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id  uuid        NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  storage_key          text        NOT NULL,
  original_filename     text,
  mime_type              text,
  file_size               integer,
  attachment_type          text        NOT NULL DEFAULT 'customer_submission'
    CHECK (attachment_type IN (
      'customer_submission',
      'damage_closeup',
      'reference_image',
      'before_service',
      'after_service',
      'inspection',
      'shipping_damage',
      'document',
      'video'
    )),
  sort_order                integer     NOT NULL DEFAULT 0,
  uploaded_by                 text        NOT NULL DEFAULT 'customer',
  created_at                   timestamptz NOT NULL DEFAULT now(),
  deleted_at                    timestamptz
);

CREATE INDEX IF NOT EXISTS service_request_attachments_request_idx
  ON public.service_request_attachments (service_request_id, deleted_at);

ALTER TABLE public.service_request_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON public.service_request_attachments USING (false) WITH CHECK (false);

-- ── Seed the four real Restoration & Preservation services ────────────
-- "BingBing Jade Client Polishing" is a discounted tier of `polishing`,
-- not a separate row — matches the existing client_type toggle exactly.
INSERT INTO public.services (
  slug, name, description, category,
  base_price_cents, discounted_price_cents, estimated_timeline, discounted_timeline,
  workflow_mode, requires_image_review, min_images, max_images,
  requires_customer_verification, requires_shipping, requires_return_shipping,
  sort_order
) VALUES
  (
    'polishing',
    'Standard Polishing',
    'Professional surface polishing that restores natural luster and removes light abrasions.',
    'restoration_preservation',
    10000, 5000, '4–6 weeks', '2–4 weeks',
    'authorization_hold', true, 1, 5,
    true, true, true,
    10
  ),
  (
    'silver_wrapping',
    'Silver Protective Wrapping',
    'Fine silver metalwork applied to reinforce and protect vulnerable bangle areas. Custom pricing per piece.',
    'restoration_preservation',
    NULL, NULL, 'Subject to quote', NULL,
    'quote_required', true, 1, 5,
    false, true, true,
    20
  ),
  (
    'gold_wrapping',
    'Gold Protective Wrapping',
    'Premium gold metalwork for bangles of the highest sentimental or monetary value. Custom pricing per piece.',
    'restoration_preservation',
    NULL, NULL, 'Subject to quote', NULL,
    'quote_required', true, 1, 5,
    false, true, true,
    30
  )
ON CONFLICT (slug) DO NOTHING;
