-- ============================================================
-- Migration 022 — Remove legacy friend_request notifications with no requestId
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run (idempotent — deletes matching rows; re-running deletes none).
--
-- friend_request notifications created before requestId was added to the payload
-- have no requestId, so their Accept/Decline buttons can't action anything —
-- they're unrespondable clutter. This clears them for every user.
-- ============================================================

DELETE FROM social_notifications
WHERE type = 'friend_request'
  AND (payload->>'requestId') IS NULL;
