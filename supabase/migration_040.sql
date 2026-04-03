-- Revert bundle_rules table introduced in migration_039
DROP TABLE IF EXISTS public.bundle_rules;
