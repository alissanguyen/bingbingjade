-- Migration 047: Add videos_json to sourcing_attempt_options
ALTER TABLE public.sourcing_attempt_options
  ADD COLUMN IF NOT EXISTS videos_json JSONB NOT NULL DEFAULT '[]';
