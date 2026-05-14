-- ============================================================
-- OTP verification codes
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE verification_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  code        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('signup', 'password_reset')),
  user_id     UUID,                          -- set for password_reset flows
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  reset_token TEXT,                          -- set after OTP verified (password_reset only)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for active codes
CREATE INDEX ON verification_codes (email, type, expires_at) WHERE NOT used;
-- Unique constraint on reset tokens
CREATE UNIQUE INDEX ON verification_codes (reset_token) WHERE reset_token IS NOT NULL;

-- No public access — only the service-role backend touches this table
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: look up a user's UUID by email
-- Called by the Express backend via supabase.rpc()
-- SECURITY DEFINER runs as the function owner (postgres), which
-- has access to auth.users.
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_id_by_email(target_email TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE email = target_email LIMIT 1;
$$;
