-- Migration 112: Private storage bucket for employee draft media
--
-- Mirrors migration_011's jade-videos setup: private bucket, no public read
-- or anon insert policy, so only the service role (supabaseAdmin, used
-- exclusively server-side) can read or write objects. Employee-uploaded
-- images and videos live here while a listing is EMPLOYEE_DRAFT /
-- AWAITING_APPROVAL / NEEDS_ADJUSTMENT / APPROVED_UNPUBLISHED. On publish,
-- the server copies the approved objects into the existing jade-images /
-- jade-videos buckets and rewrites the product's images/videos paths.

insert into storage.buckets (id, name, public)
values ('jade-employee-drafts', 'jade-employee-drafts', false)
on conflict (id) do nothing;

-- No public read policy, no anon insert policy — access is exclusively via
-- the service role key through authenticated Next.js routes.
