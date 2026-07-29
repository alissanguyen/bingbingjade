-- Migration 108: Listing submissions + reviews (employee approval workflow)
--
-- listing_submissions is the immutable, versioned record created every time
-- an employee clicks "Submit for Approval" — content_snapshot captures the
-- full listing state (including image/video paths) at that moment, so the
-- history survives later edits. listing_reviews records each admin decision
-- against a submission. Field-level previous/new-value diffs and "who did
-- it" for arbitrary changes are covered by the generic audit_logs table
-- (migration_111); these two tables are the domain-specific submission/
-- review record.
--
-- employee_id uses ON DELETE RESTRICT (not CASCADE): approved_users rows for
-- catalog contributors are never meant to be hard-deleted once they have any
-- history (accounts are deactivated/terminated instead — see admin employee
-- management), and RESTRICT enforces that at the DB level regardless of
-- what application code does.

CREATE TABLE IF NOT EXISTS listing_submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  employee_id      UUID        NOT NULL REFERENCES approved_users(id) ON DELETE RESTRICT,
  version          INT         NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'needs_adjustment')),
  content_snapshot JSONB       NOT NULL,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_listing_submissions_product_id ON listing_submissions(product_id);
CREATE INDEX IF NOT EXISTS idx_listing_submissions_employee_id ON listing_submissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_listing_submissions_status ON listing_submissions(status);

ALTER TABLE listing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON listing_submissions USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS listing_reviews (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id            UUID        NOT NULL REFERENCES listing_submissions(id) ON DELETE CASCADE,
  reviewed_by_admin_id     TEXT        NOT NULL,
  decision                 TEXT        NOT NULL
                            CHECK (decision IN ('approve', 'approve_and_publish', 'request_adjustment', 'reject', 'duplicate')),
  employee_visible_feedback TEXT,
  private_admin_notes      TEXT,
  reviewed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Reject and request-adjustment decisions must carry employee-visible
  -- reasoning/instructions — enforced here, not just in application code.
  CHECK (decision NOT IN ('reject', 'request_adjustment', 'duplicate') OR employee_visible_feedback IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_listing_reviews_submission_id ON listing_reviews(submission_id);

ALTER TABLE listing_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin service role only" ON listing_reviews USING (false) WITH CHECK (false);
