-- Migration 126: 48-hour claim-reporting window applies to ALL claim types
--
-- migration_125 set damage_reporting_days to 48h (2 days) only. Extends the
-- same 48-hour window to missing-package, Ship Now sizing, and
-- not-as-described reporting. Downstream logistics windows (return
-- drop-off, label expiration, customer-response, insurance-evidence) are
-- untouched — this only affects "how long after delivery can a claim be
-- opened."
--
-- Already applied directly to the live claim_windows rows; this migration
-- makes the change reproducible/auditable, same as migration_125.

UPDATE public.claim_windows
SET days = 2, updated_by = 'admin:policy-update', updated_at = now()
WHERE window_key IN ('missing_package_reporting_days', 'ship_now_return_days', 'sizing_return_days');
