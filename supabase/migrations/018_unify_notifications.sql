-- ============================================================
-- Migration 018 — Unify all notifications onto social_notifications
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Expands the social_notifications type check to also cover the two
-- legacy activity events ('mention', 'note_uploaded') so every
-- notification flows through one table.
--
-- The old `activities` and `notifications` tables (migration 008) are
-- intentionally LEFT IN PLACE — we stop writing to them but keep the
-- history. Nothing reads them except the legacy GET /api/notifications,
-- which stays alive for backward compatibility.
-- ============================================================

ALTER TABLE social_notifications DROP CONSTRAINT IF EXISTS social_notifications_type_ok;

ALTER TABLE social_notifications ADD CONSTRAINT social_notifications_type_ok
  CHECK (type IN (
    'friend_request',
    'notebook_invite',
    'friend_accepted',
    'mention',
    'note_uploaded'
  ));
