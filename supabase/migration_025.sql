-- migration_025: Multi-contact history per customer
-- Adds customer_emails and customer_phones tables so each customer can
-- have multiple emails, phones (with labels), tracked historically.
-- Existing data is seeded from customers.customer_email / customer_phone.
-- The original columns are kept for backwards-compat as the "primary" value.

CREATE TABLE IF NOT EXISTS public.customer_emails (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  label       text        NOT NULL DEFAULT 'Primary',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, email)
);
CREATE INDEX IF NOT EXISTS customer_emails_customer_id_idx ON public.customer_emails(customer_id);
ALTER TABLE public.customer_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_phones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  label       text        NOT NULL DEFAULT 'Mobile',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_phones_customer_id_idx ON public.customer_phones(customer_id);
ALTER TABLE public.customer_phones ENABLE ROW LEVEL SECURITY;

-- Seed from existing primary email/phone
INSERT INTO public.customer_emails (customer_id, email, label)
SELECT id, customer_email, 'Primary'
FROM public.customers
WHERE customer_email IS NOT NULL AND customer_email <> ''
ON CONFLICT (customer_id, email) DO NOTHING;

INSERT INTO public.customer_phones (customer_id, phone, label)
SELECT id, customer_phone, 'Mobile'
FROM public.customers
WHERE customer_phone IS NOT NULL AND customer_phone <> '';
