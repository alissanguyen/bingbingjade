-- Migration 128: Recipient tax ID for customs-required countries
-- Some destination countries (Brazil, Mexico, Argentina, Chile, Peru,
-- Indonesia, Saudi Arabia) require the recipient's national tax ID
-- (e.g. CPF/CNPJ, RFC, CUIT, RUT, NIK/NPWP) to clear customs.
--
-- The value is encrypted at the application layer (AES-256-GCM, see
-- lib/tax-id.ts) before it ever reaches the database — only the
-- ciphertext is stored here. tax_id_last4 is the plaintext last 4
-- characters only, kept unencrypted so the admin UI can show a masked
-- preview ("•••• 1234") without decrypting anything.

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS tax_id_ciphertext text,
  ADD COLUMN IF NOT EXISTS tax_id_last4 text;

-- Audit log: every time an admin/approved user decrypts and views a
-- recipient's tax ID, a row is recorded here. Never updated or deleted
-- from the app — an append-only access trail.
CREATE TABLE IF NOT EXISTS public.tax_id_reveals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  address_id        uuid        REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  revealed_by_type  text        NOT NULL CHECK (revealed_by_type IN ('admin', 'approved')),
  revealed_by_id    text,
  revealed_by_label text        NOT NULL,
  revealed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_id_reveals_order_id_idx ON public.tax_id_reveals (order_id);
CREATE INDEX IF NOT EXISTS tax_id_reveals_revealed_at_idx ON public.tax_id_reveals (revealed_at DESC);

ALTER TABLE public.tax_id_reveals ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only
