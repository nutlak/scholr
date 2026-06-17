-- ============================================================
-- Migration 017 — Friend management (blocks + online presence)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Usernames + profile data live in the `profiles` table (migration 015),
-- so last_active is added there.
-- ============================================================

-- ── blocks table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blocks_pair_unique UNIQUE (blocker, blocked),
  CONSTRAINT blocks_no_self     CHECK  (blocker <> blocked)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks (blocker);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- ── online presence ──────────────────────────────────────────
-- last_active drives the green/grey online dot (online = within 5 min).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles (last_active DESC);

-- profiles RLS is already enabled by earlier migrations; harmless to re-assert.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
