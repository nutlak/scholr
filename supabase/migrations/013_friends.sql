-- ============================================================
-- Migration 013 — Friends system (mutual friendships + pending requests)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
-- ============================================================

-- ── friendships table ────────────────────────────────────────
-- One row per accepted mutual friendship, regardless of direction.
-- user_a is ALWAYS the lexicographically smaller UUID so each pair
-- has exactly one row. The CHECK constraint enforces this invariant
-- at the database level.
CREATE TABLE IF NOT EXISTS friendships (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friendships_pair_unique UNIQUE (user_a, user_b),
  CONSTRAINT friendships_ordered     CHECK  (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a
  ON friendships (user_a);

CREATE INDEX IF NOT EXISTS idx_friendships_user_b
  ON friendships (user_b);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- ── friend_requests table ────────────────────────────────────
-- One row per directional request (from_user → to_user). The status
-- starts at 'pending' and transitions to 'accepted' or 'declined'.
-- A declined request can be re-sent by flipping status back to 'pending'.
CREATE TABLE IF NOT EXISTS friend_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT friend_requests_pair_unique UNIQUE (from_user, to_user),
  CONSTRAINT friend_requests_no_self     CHECK  (from_user <> to_user),
  CONSTRAINT friend_requests_status_ok   CHECK  (status IN ('pending', 'accepted', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status
  ON friend_requests (to_user, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from
  ON friend_requests (from_user);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
