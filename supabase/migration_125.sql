-- Migration 125: Damage claims must be reported within 48 hours of delivery
--
-- Business policy: damage must be reported quickly after delivery, before it
-- becomes ambiguous whether it happened in transit or afterward. 48 hours =
-- 2 days, which fits the existing integer `days` column exactly — no schema
-- change needed. Only damage_reporting_days changes; missing-package,
-- sizing, and not-as-described windows are unaffected.
--
-- This value was already applied directly against the live claim_windows
-- row (admin config, not app code) when this policy was set; this migration
-- exists so the change is reproducible/auditable like every other seed
-- change in this repo.

UPDATE public.claim_windows
SET days = 2, updated_by = 'admin:policy-update', updated_at = now()
WHERE window_key = 'damage_reporting_days';
