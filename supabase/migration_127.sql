-- Migration 127: allow 'labor_day' as a campaign_events category
--
-- migration_074 created campaign_events with a CHECK constraint pinning
-- `category` to a fixed list. lib/campaign-categories.ts added "labor_day"
-- (Labor Day sale campaign), so the DB constraint must be widened to match
-- or campaign creation fails with:
--   new row for relation "campaign_events" violates check constraint
--   "campaign_events_category_check"
--
-- Keep this list in sync with CAMPAIGN_CATEGORIES in lib/campaign-categories.ts.

ALTER TABLE public.campaign_events
  DROP CONSTRAINT IF EXISTS campaign_events_category_check;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_category_check
  CHECK (category IN (
    'black_friday','cyber_monday','valentines_day','mothers_day','womens_day',
    'birthday','lunar_new_year','labor_day','christmas','anniversary',
    'flash_sale','vip_access','last_chance'
  ));
