-- Migration 123: Delivered Order Claims / Returns / Issue Resolution workflow
--
-- New, purely additive subsystem — no existing table is altered destructively.
-- Reuses existing infrastructure rather than duplicating it:
--   - store_credits / store_credit_transactions (migration_102) is extended
--     (new `reason` values + `claim_id` FK) instead of building a parallel
--     credit ledger. issueStoreCredit()/adjustStoreCreditBalance() already
--     give append-only, non-overwriting balance history (lib/store-credit.ts).
--   - orders / order_items / shipments (migration_042) are read and snapshotted,
--     never mutated by this migration except two new nullable link columns on
--     `orders` for replacement-order traceability (§19 of the spec).
--   - audit_logs (migration_111 / lib/audit.ts) remains for sensitive
--     admin-action auditing; claims get their own richer, customer-relevant
--     claim_timeline_events table (append-only, mirrors shipment_events'
--     event-log shape from migration_042).
--
-- Status columns (claims.status, returns.status, carrier_cases.status,
-- insurance_claims.status) are intentionally `text` with no CHECK constraint,
-- matching the existing orders.order_status convention (TypeScript-enforced
-- union, not DB-enforced) — these are actively-evolving, many-valued
-- workflow fields per claim type. Smaller, stable enums (claim_type,
-- category, resolution_type, event_type, label_status, ...) DO get CHECK
-- constraints, matching the store_credits precedent.
--
-- All new tables are service-role-only (RLS enabled, no public policy) —
-- same pattern as store_credits / order_payments. Every customer-facing read
-- goes through a Next.js route using supabaseAdmin server-side, never direct
-- client access.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Numbering sequences (mirrors next_order_number() from migration_019)
-- ════════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS public.claim_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS public.return_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS public.carrier_case_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS public.insurance_claim_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.next_claim_number() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'CLM-' || nextval('public.claim_number_seq')::text;
$$;

CREATE OR REPLACE FUNCTION public.next_return_number() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'RET-' || nextval('public.return_number_seq')::text;
$$;

CREATE OR REPLACE FUNCTION public.next_carrier_case_number() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'CAR-' || nextval('public.carrier_case_number_seq')::text;
$$;

CREATE OR REPLACE FUNCTION public.next_insurance_claim_number() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'INS-' || nextval('public.insurance_claim_number_seq')::text;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1b. Private storage bucket for claim evidence (mirrors service-request-
--     attachments: private, signed URLs, customer- and admin-uploaded).
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-evidence', 'claim-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Configuration — evidence requirements + claim/return windows (§8, §31)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.claim_evidence_requirements (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_type                  text        NOT NULL UNIQUE
                                 CHECK (claim_type IN ('missing_package', 'damaged_item', 'not_as_described', 'doesnt_fit')),
  photos_required              boolean     NOT NULL DEFAULT false,
  min_photos                   integer     NOT NULL DEFAULT 0,
  max_photos                   integer     NOT NULL DEFAULT 10,
  video_required               boolean     NOT NULL DEFAULT false,
  video_optional               boolean     NOT NULL DEFAULT true,
  packaging_photos_required    boolean     NOT NULL DEFAULT false,
  written_explanation_required boolean     NOT NULL DEFAULT false,
  original_packaging_required  boolean     NOT NULL DEFAULT false,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   text
);

INSERT INTO public.claim_evidence_requirements
  (claim_type, photos_required, min_photos, max_photos, video_required, video_optional, packaging_photos_required, written_explanation_required, original_packaging_required)
VALUES
  ('missing_package',   false, 0, 10, false, true,  false, false, false),
  ('damaged_item',      true,  1, 10, false, true,  true,  true,  true),
  ('not_as_described',  true,  1, 10, false, true,  false, true,  true),
  ('doesnt_fit',        false, 0, 10, false, true,  false, false, true)
ON CONFLICT (claim_type) DO NOTHING;

ALTER TABLE public.claim_evidence_requirements ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only. Read via
-- GET /api/orders/[orderNumber]/claims/requirements (unauthenticated but
-- server-side, using supabaseAdmin) and the admin claim routes; never
-- queried directly with an anon/authenticated client key.

CREATE TABLE IF NOT EXISTS public.claim_windows (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  window_key text        NOT NULL UNIQUE
               CHECK (window_key IN (
                 'damage_reporting_days', 'missing_package_reporting_days',
                 'ship_now_return_days', 'sizing_return_days',
                 'return_dropoff_days', 'return_label_expiration_days',
                 'customer_response_days', 'insurance_evidence_days'
               )),
  days        integer     NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

INSERT INTO public.claim_windows (window_key, days) VALUES
  ('damage_reporting_days', 14),
  ('missing_package_reporting_days', 30),
  ('ship_now_return_days', 14),
  ('sizing_return_days', 14),
  ('return_dropoff_days', 10),
  ('return_label_expiration_days', 14),
  ('customer_response_days', 7),
  ('insurance_evidence_days', 10)
ON CONFLICT (window_key) DO NOTHING;

ALTER TABLE public.claim_windows ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only, same reasoning as
-- claim_evidence_requirements above.

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Claims (§1, §2)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.claims (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number                   text        NOT NULL UNIQUE DEFAULT public.next_claim_number(),
  order_id                       uuid        NOT NULL REFERENCES public.orders(id),
  customer_id                    uuid        REFERENCES public.customers(id),
  customer_email                 text        NOT NULL,

  claim_type                     text        NOT NULL
                                    CHECK (claim_type IN ('missing_package', 'damaged_item', 'not_as_described', 'doesnt_fit')),
  claim_subtype                  text        CHECK (claim_subtype IN ('lost_in_transit', 'marked_delivered_not_located')),
  fit_issue                      text        CHECK (fit_issue IN ('too_small', 'too_large', 'other')),

  -- Detailed internal workflow status (see lib/claims.ts for the per-type
  -- status machine). Customer-facing status is a pure derived mapping of
  -- this column — kept out of the DB to avoid the two ever drifting.
  status                         text        NOT NULL DEFAULT 'received',
  -- Who/what the claim is currently waiting on (§27) — powers the queue.
  responsibility                 text        NOT NULL DEFAULT 'bbj_action_required'
                                    CHECK (responsibility IN (
                                      'bbj_action_required', 'customer_action_required', 'waiting_on_carrier',
                                      'waiting_on_insurer', 'waiting_on_vendor', 'return_in_transit',
                                      'inspecting', 'resolution_pending', 'closed'
                                    )),
  priority                       text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_admin                 text,
  next_action                    text,
  next_action_due_at             timestamptz,

  description                    text,       -- customer's written description of what happened

  -- Eligibility engine result (§30) — computed at submission, admin-overridable.
  eligibility_result              text        NOT NULL DEFAULT 'eligible'
                                     CHECK (eligibility_result IN ('eligible', 'ineligible', 'requires_admin_review')),
  eligibility_reason              text,
  eligibility_overridden_by       text,
  eligibility_overridden_at       timestamptz,
  eligibility_override_reason     text,

  -- Original packaging acknowledgment (§4, §5, §6) — one per claim since a
  -- claim covers one incident even across multiple items.
  packaging_ack_at                timestamptz,
  packaging_ack_policy_text       text,       -- exact wording the customer agreed to, snapshotted

  -- Snapshot of the outbound shipment at the moment the claim was opened
  -- (§35) — must not depend indefinitely on mutable shipments/orders rows.
  original_shipment_snapshot      jsonb,

  -- Stripe dispute/chargeback link (§34) — informational only, never
  -- auto-changes resolution.
  has_stripe_dispute               boolean     NOT NULL DEFAULT false,
  stripe_dispute_id                text,
  stripe_dispute_status            text,
  stripe_dispute_amount_cents      integer,

  resolution_id                    uuid,       -- set once, gates double-resolution (FK added after claim_resolutions exists)

  reopened_count                   integer     NOT NULL DEFAULT 0,

  opened_at                        timestamptz NOT NULL DEFAULT now(),
  resolved_at                      timestamptz,
  closed_at                        timestamptz,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claims_order_id_idx        ON public.claims (order_id);
CREATE INDEX IF NOT EXISTS claims_customer_email_idx  ON public.claims (customer_email);
CREATE INDEX IF NOT EXISTS claims_status_idx           ON public.claims (status);
CREATE INDEX IF NOT EXISTS claims_responsibility_idx   ON public.claims (responsibility) WHERE status NOT IN ('closed', 'denied');
CREATE INDEX IF NOT EXISTS claims_claim_type_idx       ON public.claims (claim_type);

CREATE OR REPLACE FUNCTION public._claims_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS claims_updated_at ON public.claims;
CREATE TRIGGER claims_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only. Customer access goes through
-- Next.js API routes (order-number-keyed, matching /orders/[orderNumber]).

-- ── Claim items ────────────────────────────────────────────────────────────
-- One row per affected order_item. Snapshots identity/value fields that
-- live upstream on order_items/products so the claim record stays accurate
-- even if the product listing changes later (§37).

CREATE TABLE IF NOT EXISTS public.claim_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid        NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  order_item_id       uuid        NOT NULL REFERENCES public.order_items(id),
  product_id          uuid        REFERENCES public.products(id),
  sku                 char(8),
  product_name        text        NOT NULL,
  item_price_usd      numeric(10,2),
  cogs_usd            numeric(12,2),      -- internal only, never surfaced to customer
  certificate_number  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS claim_items_claim_id_idx      ON public.claim_items (claim_id);
CREATE INDEX IF NOT EXISTS claim_items_order_item_id_idx ON public.claim_items (order_item_id);

ALTER TABLE public.claim_items ENABLE ROW LEVEL SECURITY;

-- ── Evidence / document center (§9) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.claim_evidence (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id            uuid        NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  claim_item_id       uuid        REFERENCES public.claim_items(id) ON DELETE SET NULL,
  uploaded_by_type    text        NOT NULL CHECK (uploaded_by_type IN ('customer', 'admin')),
  uploaded_by         text        NOT NULL,   -- customer email or admin identifier
  category            text        NOT NULL CHECK (category IN (
                         'item_photo', 'packaging_outer_photo', 'packaging_inner_photo', 'video',
                         'written_statement', 'dropoff_receipt',
                         'qc_photo', 'qc_video', 'packing_video', 'certificate', 'order_snapshot',
                         'shipping_label', 'proof_of_delivery', 'carrier_correspondence',
                         'insurance_correspondence', 'return_inspection_photo', 'return_inspection_video',
                         'vendor_correspondence', 'refund_proof', 'reimbursement_proof', 'other'
                       )),
  storage_path        text,       -- private bucket path; resolved to a signed URL at render time
  file_name            text,
  content_type         text,
  caption               text,
  -- Admin evidence (QC, correspondence, internal proof) defaults to internal-only.
  -- Customer uploads default visible (they uploaded it themselves).
  customer_visible      boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_evidence_claim_id_idx ON public.claim_evidence (claim_id);

ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;

-- ── Immutable timeline (§25) ───────────────────────────────────────────────
-- Insert-only by application convention (no UPDATE/DELETE routes are ever
-- built against this table) — mirrors shipment_events' append-only usage.

CREATE TABLE IF NOT EXISTS public.claim_timeline_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id              uuid        NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  actor_type            text        NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  actor                 text        NOT NULL,   -- customer email, admin identifier, or 'system'
  action                text        NOT NULL,   -- machine key, e.g. 'status_changed', 'evidence_uploaded'
  old_status             text,
  new_status              text,
  -- Customer-visible note vs internal note are DIFFERENT COLUMNS, never
  -- the same field reused with a flag (§26) — an admin writing an internal
  -- note can never accidentally leak it to the portal.
  customer_note           text,
  internal_note           text,
  related_object_type     text,       -- 'return', 'return_shipment', 'carrier_case', 'insurance_claim', 'resolution', ...
  related_object_id       uuid,
  metadata                 jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_timeline_claim_id_idx ON public.claim_timeline_events (claim_id, created_at);

ALTER TABLE public.claim_timeline_events ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Returns (§10–§14)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.returns (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number                    text        NOT NULL UNIQUE DEFAULT public.next_return_number(),
  claim_id                         uuid        NOT NULL REFERENCES public.claims(id),
  order_id                         uuid        NOT NULL REFERENCES public.orders(id),

  return_type                      text        NOT NULL CHECK (return_type IN (
                                       'damage_insurance_return', 'not_as_described', 'sizing_refund', 'sizing_exchange'
                                     )),
  status                           text        NOT NULL DEFAULT 'requested',

  dropoff_deadline_at               timestamptz,
  dropoff_deadline_original_at      timestamptz,   -- first deadline ever set — immutable

  -- Expected components for physical return (§12), e.g.
  -- [{"component":"original_box","required":true,"customer_allowed_to_keep":false,"outcome":null}]
  expected_components                jsonb       NOT NULL DEFAULT '[]'::jsonb,

  restocking_fee_waived              boolean     NOT NULL DEFAULT false,
  restocking_fee_waived_reason       text,
  restocking_fee_waived_by           text,

  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS returns_claim_id_idx ON public.returns (claim_id);
CREATE INDEX IF NOT EXISTS returns_order_id_idx ON public.returns (order_id);
CREATE INDEX IF NOT EXISTS returns_status_idx   ON public.returns (status);

DROP TRIGGER IF EXISTS returns_updated_at ON public.returns;
CREATE TRIGGER returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- ── Return shipments (§10, §14) — separate from outbound `shipments` ───────
-- Multiple rows per return only if a label is reissued (old row marked
-- 'voided', new row created) — never overwritten in place.

CREATE TABLE IF NOT EXISTS public.return_shipments (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id                   uuid        NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  carrier                     text,
  service_level                text,
  tracking_number               text,
  label_storage_path            text,
  label_file_url_external       text,       -- if the label lives outside our storage (carrier-hosted URL)
  label_created_at              timestamptz,
  label_expires_at              timestamptz,
  quoted_label_cost_usd          numeric(10,2),
  final_label_cost_usd            numeric(10,2),   -- separate from quoted — carriers adjust after the fact
  package_weight_oz               numeric(10,2),
  package_length_in               numeric(6,2),
  package_width_in                 numeric(6,2),
  package_height_in                numeric(6,2),
  insurance_purchased               boolean     NOT NULL DEFAULT false,
  insured_value_usd                  numeric(10,2),
  insurance_premium_usd               numeric(10,2),
  cost_borne_by                        text        NOT NULL DEFAULT 'bbj' CHECK (cost_borne_by IN ('bbj', 'customer')),
  deduct_from_refund                    boolean     NOT NULL DEFAULT false,
  label_status                          text        NOT NULL DEFAULT 'created'
                                            CHECK (label_status IN ('created', 'used', 'voided', 'expired')),
  customer_dropoff_reported_at            timestamptz,   -- NOT proof of carrier possession (§11)
  carrier_acceptance_scan_at               timestamptz,   -- objective evidence
  in_transit_status                         text,
  delivered_to_bbj_at                        timestamptz,
  carrier_adjustment_usd                      numeric(10,2),
  carrier_adjustment_note                      text,
  created_at                                   timestamptz NOT NULL DEFAULT now(),
  updated_at                                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_shipments_return_id_idx ON public.return_shipments (return_id);
CREATE INDEX IF NOT EXISTS return_shipments_tracking_idx  ON public.return_shipments (tracking_number) WHERE tracking_number IS NOT NULL;

DROP TRIGGER IF EXISTS return_shipments_updated_at ON public.return_shipments;
CREATE TRIGGER return_shipments_updated_at BEFORE UPDATE ON public.return_shipments
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.return_shipments ENABLE ROW LEVEL SECURITY;

-- ── Return inspection (§13) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.return_inspections (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id                   uuid        NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  received_at                  timestamptz,
  received_by                    text,
  inspected_by                    text,
  inspected_at                     timestamptz,
  correct_item_returned              boolean,
  sku_matches                          boolean,
  order_item_matches                    boolean,
  certificate_number_matches             boolean,
  certificate_returned                    boolean,
  original_packaging_returned              boolean,
  accessories_returned                      boolean,
  new_scratches                              boolean,
  chips                                        boolean,
  cracks                                        boolean,
  damage_found                                  boolean,
  alteration                                    boolean,
  wear                                          boolean,
  condition_notes                                text,
  restockable                                     boolean,
  result                                          text CHECK (result IN (
                                                     'approved_as_received', 'approved_with_deduction', 'needs_further_review',
                                                     'incorrect_item_returned', 'item_materially_damaged',
                                                     'missing_required_components', 'rejected', 'admin_override'
                                                   )),
  deduction_amount_usd                             numeric(10,2),
  created_at                                        timestamptz NOT NULL DEFAULT now(),
  updated_at                                        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_inspections_return_id_idx ON public.return_inspections (return_id);

DROP TRIGGER IF EXISTS return_inspections_updated_at ON public.return_inspections;
CREATE TRIGGER return_inspections_updated_at BEFORE UPDATE ON public.return_inspections
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.return_inspections ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Carrier / insurance / vendor tracking (§20, §21, §22)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.carrier_cases (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number             text        NOT NULL UNIQUE DEFAULT public.next_carrier_case_number(),
  claim_id                 uuid        NOT NULL REFERENCES public.claims(id),
  order_id                  uuid        NOT NULL REFERENCES public.orders(id),
  return_shipment_id          uuid        REFERENCES public.return_shipments(id),  -- set only for return-leg investigations
  carrier                       text        NOT NULL,
  carrier_case_reference          text,
  case_type                        text        NOT NULL CHECK (case_type IN ('outbound_lost', 'outbound_damaged', 'return_lost', 'return_damaged')),
  status                            text        NOT NULL DEFAULT 'opened',
  requested_amount_usd                numeric(10,2),
  liability_maximum_usd                numeric(10,2),
  approved_amount_usd                   numeric(10,2),
  denied_amount_usd                      numeric(10,2),
  denial_reason                           text,
  opened_at                                timestamptz NOT NULL DEFAULT now(),
  decision_at                               timestamptz,
  reimbursement_received_at                  timestamptz,
  reimbursement_method                        text,
  notes                                        text,
  created_at                                    timestamptz NOT NULL DEFAULT now(),
  updated_at                                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carrier_cases_claim_id_idx ON public.carrier_cases (claim_id);

DROP TRIGGER IF EXISTS carrier_cases_updated_at ON public.carrier_cases;
CREATE TRIGGER carrier_cases_updated_at BEFORE UPDATE ON public.carrier_cases
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.carrier_cases ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_claim_number       text        NOT NULL UNIQUE DEFAULT public.next_insurance_claim_number(),
  claim_id                      uuid        NOT NULL REFERENCES public.claims(id),
  order_id                       uuid        NOT NULL REFERENCES public.orders(id),
  leg                              text        NOT NULL CHECK (leg IN ('outbound', 'return')),
  insurer                            text,
  policy_source                       text,       -- e.g. carrier-provided, third-party shipping insurer
  insured_value_usd                     numeric(10,2),
  premium_usd                            numeric(10,2),
  insurer_case_number                     text,       -- the insurer's own reference, distinct from our INS-xxxx
  filed_at                                 timestamptz,
  amount_claimed_usd                        numeric(10,2),
  status                                     text        NOT NULL DEFAULT 'not_filed',
  additional_documentation_requested            boolean     NOT NULL DEFAULT false,
  approved_amount_usd                             numeric(10,2),
  denied_amount_usd                                numeric(10,2),
  denial_reason                                     text,
  decision_at                                        timestamptz,
  -- Approved ≠ received (§21) — tracked as two distinct facts.
  payout_expected_usd                                 numeric(10,2),
  payout_received_usd                                  numeric(10,2),
  payout_received_at                                    timestamptz,
  payout_method                                          text,
  notes                                                   text,
  created_at                                               timestamptz NOT NULL DEFAULT now(),
  updated_at                                               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_claims_claim_id_idx ON public.insurance_claims (claim_id);

DROP TRIGGER IF EXISTS insurance_claims_updated_at ON public.insurance_claims;
CREATE TRIGGER insurance_claims_updated_at BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.vendor_reimbursements (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                  uuid        NOT NULL REFERENCES public.claims(id),
  order_item_id               uuid        REFERENCES public.order_items(id),
  vendor_name                   text        NOT NULL,
  amount_requested                 numeric(12,2),
  currency                           text        NOT NULL DEFAULT 'USD',
  exchange_rate                        numeric(12,6),
  amount_requested_usd                   numeric(12,2),
  amount_approved_usd                      numeric(12,2),
  amount_received_usd                        numeric(12,2),
  requested_at                                 timestamptz,
  approved_at                                    timestamptz,
  received_at                                      timestamptz,
  reimbursement_method                              text,
  vendor_return_required                              boolean     NOT NULL DEFAULT false,
  vendor_return_at                                      timestamptz,
  vendor_return_carrier                                  text,
  vendor_return_tracking_number                           text,
  vendor_return_shipping_cost_usd                           numeric(10,2),
  notes                                                       text,
  created_at                                                   timestamptz NOT NULL DEFAULT now(),
  updated_at                                                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_reimbursements_claim_id_idx ON public.vendor_reimbursements (claim_id);

DROP TRIGGER IF EXISTS vendor_reimbursements_updated_at ON public.vendor_reimbursements;
CREATE TRIGGER vendor_reimbursements_updated_at BEFORE UPDATE ON public.vendor_reimbursements
  FOR EACH ROW EXECUTE FUNCTION public._claims_set_updated_at();

ALTER TABLE public.vendor_reimbursements ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Resolution + financial ledger (§15–§19, §23, §24)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.claim_resolutions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id               uuid        NOT NULL REFERENCES public.claims(id),
  resolution_type          text        NOT NULL CHECK (resolution_type IN (
                              'full_cash_refund', 'partial_cash_refund', 'store_credit', 'exchange_credit',
                              'replacement_merchandise', 'repair_restoration', 'combination', 'denied', 'other'
                            )),
  decided_at                 timestamptz NOT NULL DEFAULT now(),
  decided_by                    text        NOT NULL,
  customer_accepted_at             timestamptz,
  -- Internal notes vs the customer-safe summary are separate columns (§26).
  internal_notes                     text,
  customer_summary                     text,
  created_at                             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_resolutions_claim_id_idx ON public.claim_resolutions (claim_id);

ALTER TABLE public.claims
  ADD CONSTRAINT claims_resolution_id_fkey FOREIGN KEY (resolution_id) REFERENCES public.claim_resolutions(id);

ALTER TABLE public.claim_resolutions ENABLE ROW LEVEL SECURITY;

-- ── Refund detail object (§17) — Stripe or manual ───────────────────────────

CREATE TABLE IF NOT EXISTS public.claim_refunds (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                         uuid        NOT NULL REFERENCES public.claims(id),
  resolution_id                      uuid        NOT NULL REFERENCES public.claim_resolutions(id),
  order_id                             uuid        NOT NULL REFERENCES public.orders(id),
  method                                  text        NOT NULL CHECK (method IN ('stripe', 'zelle', 'ach', 'wire', 'check', 'cash', 'other')),
  stripe_payment_intent_id                  text,
  stripe_charge_id                            text,
  stripe_refund_id                              text,
  amount_usd                                     numeric(10,2) NOT NULL,
  status                                           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  transaction_fee_retained_usd                       numeric(10,2),
  reference_number                                     text,       -- non-Stripe transaction/reference number
  proof_storage_path                                     text,
  initiated_at                                             timestamptz NOT NULL DEFAULT now(),
  initiated_by                                               text        NOT NULL,
  admin_notes                                                 text,
  created_at                                                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_refunds_claim_id_idx ON public.claim_refunds (claim_id);

ALTER TABLE public.claim_refunds ENABLE ROW LEVEL SECURITY;

-- ── Itemized financial ledger (§16, §24) — append-only, never overwritten ──
-- amount_usd sign convention: NEGATIVE = value/cash leaving BBJ (refund,
-- label cost, credit issued, replacement COGS). POSITIVE = value coming
-- back to BBJ (carrier/insurance/vendor reimbursement, restocking fee
-- retained, waived-fee reversal). Corrections are new offsetting rows,
-- never UPDATEs to amount_usd on an existing row.

CREATE TABLE IF NOT EXISTS public.claim_financial_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id           uuid        NOT NULL REFERENCES public.claims(id),
  order_id            uuid        NOT NULL REFERENCES public.orders(id),
  resolution_id         uuid        REFERENCES public.claim_resolutions(id),
  event_type              text        NOT NULL CHECK (event_type IN (
                             'merchandise_amount', 'tax', 'outbound_shipping', 'outbound_shipping_insurance_premium',
                             'return_shipping_label_cost', 'return_shipping_insurance_premium',
                             'restocking_fee', 'restocking_fee_waived', 'transaction_fee_retained',
                             'other_deduction', 'cash_refund', 'store_credit_issued', 'exchange_credit_issued',
                             'replacement_cogs', 'replacement_shipping', 'replacement_insurance',
                             'carrier_reimbursement', 'insurance_reimbursement', 'vendor_reimbursement',
                             'other_adjustment'
                           )),
  amount_usd                numeric(12,2) NOT NULL,
  currency                     text        NOT NULL DEFAULT 'USD',
  method                          text,       -- stripe/zelle/ach/wire/check/cash/store_credit/exchange_credit/other
  source                            text,
  destination                        text,
  external_reference                   text,       -- Stripe refund id, check #, carrier check #, etc.
  waived                                 boolean     NOT NULL DEFAULT false,
  waiver_reason                            text,
  created_by                                 text        NOT NULL,   -- admin identifier or 'system'
  notes                                        text,
  metadata                                       jsonb,
  created_at                                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_financial_events_claim_id_idx ON public.claim_financial_events (claim_id);
CREATE INDEX IF NOT EXISTS claim_financial_events_order_id_idx ON public.claim_financial_events (order_id);

ALTER TABLE public.claim_financial_events ENABLE ROW LEVEL SECURITY;

-- ── Communication log (§29) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.claim_communications (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                uuid        NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  sent_at                   timestamptz NOT NULL DEFAULT now(),
  channel                     text        NOT NULL DEFAULT 'email',
  recipient                     text        NOT NULL,
  template_key                    text        NOT NULL,
  subject                           text,
  sent_status                        text        NOT NULL DEFAULT 'sent' CHECK (sent_status IN ('sent', 'failed', 'skipped')),
  failure_reason                       text,
  created_by                             text        NOT NULL   -- admin identifier or 'system'
);

CREATE INDEX IF NOT EXISTS claim_communications_claim_id_idx ON public.claim_communications (claim_id);

ALTER TABLE public.claim_communications ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Extend store_credits for exchange/claim-resolution credit (§7, §18)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.store_credits
  ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.claims(id);

CREATE INDEX IF NOT EXISTS store_credits_claim_id_idx ON public.store_credits (claim_id) WHERE claim_id IS NOT NULL;

ALTER TABLE public.store_credits DROP CONSTRAINT IF EXISTS store_credits_reason_check;
ALTER TABLE public.store_credits
  ADD CONSTRAINT store_credits_reason_check CHECK (reason IN (
    'goodwill_resolution', 'canceled_order', 'damaged_lost_package', 'return',
    'price_adjustment', 'loyalty_vip', 'other',
    'exchange_credit', 'claim_resolution'
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Replacement-order linkage (§19) — a replacement order is a normal
--    `orders` row; only two nullable link columns are needed.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_claim_id  uuid REFERENCES public.claims(id),
  ADD COLUMN IF NOT EXISTS source_return_id uuid REFERENCES public.returns(id);

CREATE INDEX IF NOT EXISTS orders_source_claim_id_idx ON public.orders (source_claim_id) WHERE source_claim_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Backward compatibility
-- ════════════════════════════════════════════════════════════════════════════
-- Every new table/column is nullable or has a safe default; no existing row
-- in `orders`, `order_items`, `shipments`, or `store_credits` requires
-- backfill. Old delivered orders with no shipping-insurance data simply
-- produce a null original_shipment_snapshot / null insured value — the
-- admin claim UI lets an admin fill in coverage information manually for
-- those (§43), and the customer-facing insurance messaging in lib/claims.ts
-- falls back to "not purchased" wording whenever the flag is null.
