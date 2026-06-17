-- ============================================================
-- Migration 016 — Social notifications (friend requests / accepts /
-- notebook invites)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- NOTE: a `notifications` table already exists (migration 008) and is
-- activity-coupled (activity_id NOT NULL → activities). It can't hold
-- friend/invite events, so this lightweight, decoupled system lives in
-- its OWN table `social_notifications` to avoid clobbering the existing
-- activity-notification feed.
-- ============================================================

CREATE TABLE IF NOT EXISTS social_notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- recipient
  type       TEXT        NOT NULL,
  payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_notifications_type_ok
    CHECK (type IN ('friend_request', 'notebook_invite', 'friend_accepted'))
);

CREATE INDEX IF NOT EXISTS idx_social_notifications_user
  ON social_notifications (user_id, read, created_at DESC);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE social_notifications ENABLE ROW LEVEL SECURITY;
