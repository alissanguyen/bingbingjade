-- Migration 113: Employee-listing workflow functions
--
-- supabase-js talks to Postgres over PostgREST, which has no client-side
-- multi-statement transactions, so every action that touches more than one
-- row/table atomically (submit, review/approve, payout creation, marking a
-- payout paid, cancelling a payout) is a SECURITY DEFINER plpgsql function
-- called via supabaseAdmin.rpc(...) — same pattern as the existing store
-- credit functions (migration_102: reserve_store_credit etc.), which this
-- mirrors: row-lock with FOR UPDATE, then read-modify-write inside one
-- transaction.
--
-- Error contract: expected/"soft" failures (wrong status, not the owner,
-- already paid, etc.) are raised via RAISE EXCEPTION with a short
-- machine-readable message (e.g. 'invalid_status:AWAITING_APPROVAL') that
-- calling TypeScript code matches on to return the right HTTP status,
-- instead of a generic 500.

-- ── Submit for approval ───────────────────────────────────────────────────────
-- Locks the product row, verifies ownership + status, creates the versioned
-- submission snapshot, and flips the product to AWAITING_APPROVAL — all
-- atomically, so two concurrent submit calls can't both succeed.

CREATE OR REPLACE FUNCTION public.fn_submit_listing(
  p_product_id uuid,
  p_employee_id uuid,
  p_snapshot jsonb
) RETURNS TABLE (submission_id uuid, version int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status  text;
  v_owner   uuid;
  v_version int;
  v_submission_id uuid;
BEGIN
  SELECT listing_status, created_by_employee_id, current_submission_version
    INTO v_status, v_owner, v_version
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  IF v_owner IS DISTINCT FROM p_employee_id THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('EMPLOYEE_DRAFT', 'NEEDS_ADJUSTMENT') THEN
    RAISE EXCEPTION 'invalid_status:%', COALESCE(v_status, 'NULL');
  END IF;

  v_version := v_version + 1;

  INSERT INTO public.listing_submissions (product_id, employee_id, version, status, content_snapshot, submitted_at)
  VALUES (p_product_id, p_employee_id, v_version, 'pending', p_snapshot, now())
  RETURNING id INTO v_submission_id;

  UPDATE public.products
  SET listing_status = 'AWAITING_APPROVAL',
      current_submission_version = v_version
  WHERE id = p_product_id;

  RETURN QUERY SELECT v_submission_id, v_version;
END;
$$;

-- ── Admin review decision ─────────────────────────────────────────────────────
-- p_decision: 'approve' | 'approve_and_publish' | 'request_adjustment' | 'reject' | 'duplicate'
-- Locks the product row, verifies AWAITING_APPROVAL, records the review
-- against the current pending submission, transitions status, and — for
-- approve/approve_and_publish only — creates exactly one compensation
-- credit via INSERT ... ON CONFLICT (product_id) DO NOTHING. That ON
-- CONFLICT is what makes "adjust → resubmit → approve again" and "admin
-- edits an already-approved product" both safe against double credits: the
-- unique constraint on listing_approval_credits.product_id wins regardless
-- of how many times this function runs for the same product.

CREATE OR REPLACE FUNCTION public.fn_review_listing(
  p_product_id uuid,
  p_admin_id text,
  p_decision text,
  p_employee_feedback text,
  p_admin_notes text
) RETURNS TABLE (new_status text, credit_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status       text;
  v_employee_id  uuid;
  v_submission_id uuid;
  v_version      int;
  v_new_status   text;
  v_submission_status text;
  v_rate         numeric;
  v_credit_id    uuid;
BEGIN
  IF p_decision NOT IN ('approve', 'approve_and_publish', 'request_adjustment', 'reject', 'duplicate') THEN
    RAISE EXCEPTION 'invalid_decision:%', p_decision;
  END IF;

  SELECT listing_status, created_by_employee_id, current_submission_version
    INTO v_status, v_employee_id, v_version
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  IF v_status IS DISTINCT FROM 'AWAITING_APPROVAL' THEN
    RAISE EXCEPTION 'invalid_status:%', COALESCE(v_status, 'NULL');
  END IF;

  SELECT id INTO v_submission_id
  FROM public.listing_submissions
  WHERE product_id = p_product_id AND version = v_version
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  CASE p_decision
    WHEN 'approve' THEN v_new_status := 'APPROVED_UNPUBLISHED'; v_submission_status := 'approved';
    WHEN 'approve_and_publish' THEN v_new_status := 'PUBLISHED'; v_submission_status := 'approved';
    WHEN 'request_adjustment' THEN v_new_status := 'NEEDS_ADJUSTMENT'; v_submission_status := 'needs_adjustment';
    WHEN 'reject' THEN v_new_status := 'REJECTED'; v_submission_status := 'rejected';
    WHEN 'duplicate' THEN v_new_status := 'REJECTED'; v_submission_status := 'rejected';
  END CASE;

  -- listing_reviews itself enforces (via CHECK) that reject/request_adjustment/
  -- duplicate carry employee_visible_feedback.
  INSERT INTO public.listing_reviews (submission_id, reviewed_by_admin_id, decision, employee_visible_feedback, private_admin_notes)
  VALUES (v_submission_id, p_admin_id, p_decision, p_employee_feedback, p_admin_notes);

  UPDATE public.listing_submissions
  SET status = v_submission_status
  WHERE id = v_submission_id;

  IF p_decision IN ('approve', 'approve_and_publish') THEN
    UPDATE public.products
    SET listing_status = v_new_status,
        is_published = (p_decision = 'approve_and_publish'),
        published_at = CASE WHEN p_decision = 'approve_and_publish' THEN now() ELSE published_at END
    WHERE id = p_product_id;

    SELECT default_rate_per_approved_listing INTO v_rate
    FROM public.employee_profiles
    WHERE user_id = v_employee_id;

    INSERT INTO public.listing_approval_credits (product_id, employee_id, approved_by_admin_id, rate_at_approval)
    VALUES (p_product_id, v_employee_id, p_admin_id, COALESCE(v_rate, 0))
    ON CONFLICT (product_id) DO NOTHING
    RETURNING id INTO v_credit_id;
  ELSE
    UPDATE public.products
    SET listing_status = v_new_status
    WHERE id = p_product_id;
  END IF;

  RETURN QUERY SELECT v_new_status, (v_credit_id IS NOT NULL);
END;
$$;

-- ── Publish an already-approved-but-unpublished listing ──────────────────────
-- Separate from review: no new credit, no review record — just flips the
-- product live. Used for the "publish later" half of APPROVED_UNPUBLISHED.

CREATE OR REPLACE FUNCTION public.fn_publish_approved_listing(
  p_product_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT listing_status INTO v_status
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR v_status IS DISTINCT FROM 'APPROVED_UNPUBLISHED' THEN
    RETURN false;
  END IF;

  UPDATE public.products
  SET listing_status = 'PUBLISHED', is_published = true, published_at = now()
  WHERE id = p_product_id;

  RETURN true;
END;
$$;

-- ── Create a payout for a custom period ───────────────────────────────────────
-- Locks and claims every eligible unpaid, unrevoked credit for this employee
-- approved within [period_start, period_end], so the same credit can never
-- be claimed by two payouts (FOR UPDATE blocks a concurrent second call
-- until this transaction commits, and payout_status is flipped to
-- 'scheduled' before commit).

CREATE OR REPLACE FUNCTION public.fn_create_payout(
  p_employee_id uuid,
  p_period_start date,
  p_period_end date,
  p_bonus_amount numeric,
  p_adjustment_amount numeric,
  p_deduction_amount numeric,
  p_payment_method text,
  p_scheduled_pay_date date,
  p_private_admin_notes text,
  p_created_by_admin_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout_id   uuid;
  v_credit_ids  uuid[];
  v_product_ids uuid[];
  v_rates       numeric[];
  v_count       int;
  v_gross       numeric;
BEGIN
  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'invalid_period';
  END IF;

  -- Row-lock every eligible credit first (in the inner subquery), then
  -- aggregate the already-locked rows into arrays. A concurrent second call
  -- for an overlapping period blocks on FOR UPDATE until this transaction
  -- commits, then sees payout_status = 'scheduled' and excludes these rows.
  SELECT array_agg(id), array_agg(product_id), array_agg(rate_at_approval),
         count(*), COALESCE(sum(rate_at_approval), 0)
    INTO v_credit_ids, v_product_ids, v_rates, v_count, v_gross
  FROM (
    SELECT id, product_id, rate_at_approval
    FROM public.listing_approval_credits
    WHERE employee_id = p_employee_id
      AND payout_status = 'unpaid'
      AND revoked_at IS NULL
      AND approved_at::date BETWEEN p_period_start AND p_period_end
    FOR UPDATE
  ) sub;

  INSERT INTO public.employee_payouts (
    employee_id, period_start, period_end, approved_listing_count, gross_listing_pay,
    bonus_amount, adjustment_amount, deduction_amount, payment_method,
    scheduled_pay_date, status, private_admin_notes, created_by_admin_id
  ) VALUES (
    p_employee_id, p_period_start, p_period_end, v_count, v_gross,
    p_bonus_amount, p_adjustment_amount, p_deduction_amount, p_payment_method,
    p_scheduled_pay_date, 'DRAFT', p_private_admin_notes, p_created_by_admin_id
  )
  RETURNING id INTO v_payout_id;

  IF v_credit_ids IS NOT NULL THEN
    INSERT INTO public.employee_payout_items (payout_id, approval_credit_id, product_id, amount)
    SELECT v_payout_id, c, p, r
    FROM unnest(v_credit_ids, v_product_ids, v_rates) AS t(c, p, r);

    UPDATE public.listing_approval_credits
    SET payout_status = 'scheduled', payout_id = v_payout_id
    WHERE id = ANY(v_credit_ids);
  END IF;

  RETURN v_payout_id;
END;
$$;

-- ── Mark a payout PAID ────────────────────────────────────────────────────────
-- Locks its items in place (payout_status='paid' on every included credit)
-- and refuses to run twice.

CREATE OR REPLACE FUNCTION public.fn_mark_payout_paid(
  p_payout_id uuid,
  p_actual_paid_date date,
  p_payment_reference text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.employee_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout_not_found';
  END IF;

  IF v_status = 'PAID' THEN
    RAISE EXCEPTION 'already_paid';
  END IF;

  IF v_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'payout_cancelled';
  END IF;

  UPDATE public.employee_payouts
  SET status = 'PAID',
      actual_paid_date = COALESCE(p_actual_paid_date, CURRENT_DATE),
      payment_reference = COALESCE(p_payment_reference, payment_reference),
      updated_at = now()
  WHERE id = p_payout_id;

  UPDATE public.listing_approval_credits
  SET payout_status = 'paid'
  WHERE payout_id = p_payout_id;

  RETURN true;
END;
$$;

-- ── Cancel a not-yet-paid payout ──────────────────────────────────────────────
-- Frees its credits back to 'unpaid' so they can be included in a future
-- payout. Refuses to touch a PAID payout — corrections after payment must be
-- a new payout with an adjustment/deduction, never a retroactive edit.

CREATE OR REPLACE FUNCTION public.fn_cancel_payout(
  p_payout_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.employee_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout_not_found';
  END IF;

  IF v_status = 'PAID' THEN
    RAISE EXCEPTION 'cannot_cancel_paid_payout';
  END IF;

  UPDATE public.listing_approval_credits
  SET payout_status = 'unpaid', payout_id = NULL
  WHERE payout_id = p_payout_id;

  DELETE FROM public.employee_payout_items WHERE payout_id = p_payout_id;

  UPDATE public.employee_payouts
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_payout_id;

  RETURN true;
END;
$$;
