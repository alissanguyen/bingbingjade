-- migration_031: approved_users table + created_by tracking on orders
--
-- Approved users can manage products and inventory but cannot see:
--   - imported_price_vnd (profit margin data)
--   - orders created by admin or other approved users

CREATE TABLE IF NOT EXISTS approved_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  full_name     TEXT        NOT NULL,
  -- access_level governs future fine-grained permissions; 'standard' is the baseline
  access_level  TEXT        NOT NULL DEFAULT 'standard'
                CHECK (access_level IN ('standard', 'senior')),
  password_hash TEXT        NOT NULL,  -- pbkdf2-sha256: "salt:hash"
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track who created each order so approved users only see their own
-- 'admin'            = created by admin or Stripe webhook
-- 'approved:<uuid>'  = created by a specific approved user
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'admin';

-- Index for the per-user order filter
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders (created_by);
