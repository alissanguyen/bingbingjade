-- Migration 084: Review images + approval workflow
--
-- Adds:
--   reviews.is_approved    — new reviews start unapproved; admin must approve before public display
--   review_images table    — one-to-many images per review, stored in the review-images bucket
--
-- Existing reviews are marked approved so they remain visible in the carousel.
-- RLS updated so the public SELECT policy only returns approved reviews.
--
-- Storage: create a PUBLIC bucket named "review-images" in the Supabase dashboard.
-- Paths follow: {review_id}/{timestamp}-{original_filename}

-- ─── 1. Approval flag ─────────────────────────────────────────────────────────

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- All existing reviews are already visible — treat them as approved
UPDATE public.reviews SET is_approved = true WHERE is_approved = false;

-- ─── 2. Review images ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_images (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid        NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  image_path  text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ri_review_id_idx ON public.review_images (review_id);

-- ─── 3. Updated RLS for reviews ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;

CREATE POLICY "Approved reviews are publicly readable"
  ON public.reviews FOR SELECT USING (is_approved = true);

-- ─── 4. RLS for review_images ─────────────────────────────────────────────────

ALTER TABLE public.review_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read images for approved reviews"
  ON public.review_images FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_id AND r.is_approved = true
    )
  );
