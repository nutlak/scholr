-- ============================================================
-- Migration 005 — Collaborative invite links
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES auth.users(id),
  token       TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Add email column if the table already exists from a prior migration run
ALTER TABLE invites ADD COLUMN IF NOT EXISTS email TEXT;

-- No RLS needed — tokens are unguessable UUIDs and the accept endpoint
-- validates auth separately. Public GET lookup by token is intentional.
