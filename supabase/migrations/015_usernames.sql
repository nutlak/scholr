-- ============================================================
-- Migration 015 — Usernames (private, unique handle per user)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Profile data already lives in the `profiles` table (keyed by user_id),
-- so usernames are added there rather than in a new table.
-- ============================================================

-- Add the username column (nullable — users set it after signup).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Case-insensitive uniqueness. A UNIQUE functional index on lower(username)
-- enforces "no two users share a handle regardless of case" AND serves as the
-- lookup index for prefix search on lower(username). NULLs are distinct in
-- Postgres, so users without a username yet don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON profiles (lower(username));

-- Pattern-ops index so prefix searches (lower(username) LIKE 'foo%') stay fast
-- even under non-C collations.
CREATE INDEX IF NOT EXISTS profiles_username_lower_prefix
  ON profiles (lower(username) text_pattern_ops);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
