-- ============================================================
-- migration_103: Preserve AI copy-generation source/vendor notes
-- per listing.
--
-- The "Source / vendor notes" textarea in the AI Copy Generation
-- panel was previously local-only React state — used to prompt
-- Claude for Generate Copy, then discarded on submit. This adds a
-- column so the original notes are kept alongside the listing for
-- future reference.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sourcing_notes text;
