-- migration_039: Replace combo_of variant dependency with bundle_rules table
--
-- bundle_rules stores set/bundle pricing rules per product.
-- When a cart contains all required_variant_ids, a discount is auto-applied
-- equal to (sum of individual prices) - bundle_price.
--
-- Migration also converts existing combo variants into bundle rules and removes them.

-- 1. Create bundle_rules table
CREATE TABLE IF NOT EXISTS public.bundle_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name            text NOT NULL,
  required_variant_ids  uuid[] NOT NULL,
  bundle_price    numeric(10,2) NOT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bundle_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public bundle_rules are readable by everyone"
  ON public.bundle_rules FOR SELECT USING (true);

CREATE POLICY "Service role can manage bundle_rules"
  ON public.bundle_rules FOR ALL USING (true);

-- 2. Migrate existing combo_of options into bundle_rules
INSERT INTO public.bundle_rules (product_id, name, required_variant_ids, bundle_price)
SELECT
  product_id,
  COALESCE(label, 'Bundle Set') AS name,
  combo_of AS required_variant_ids,
  COALESCE(sale_price_usd, price_usd) AS bundle_price
FROM public.product_options
WHERE combo_of IS NOT NULL
  AND array_length(combo_of, 1) > 0
  AND (sale_price_usd IS NOT NULL OR price_usd IS NOT NULL);

-- 3. Delete the now-redundant combo variant rows
DELETE FROM public.product_options
WHERE combo_of IS NOT NULL
  AND array_length(combo_of, 1) > 0;

-- 4. Null out any remaining combo_of references (keep column for rollback safety)
UPDATE public.product_options SET combo_of = NULL WHERE combo_of IS NOT NULL;
