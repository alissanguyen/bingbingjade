-- Migration 116: Per-employee vendor visibility
--
-- Business decision: some Catalog Contributors are trusted to see the
-- vendor list/select a vendor when creating a listing, others aren't.
-- Defaults to false (existing behavior — vendor search hidden) so nothing
-- changes for any employee until an admin explicitly opts one in.

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS can_view_vendors BOOLEAN NOT NULL DEFAULT false;
