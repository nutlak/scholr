-- ============================================================
-- Migration 021 — Renewal reminders + payment-failed (notification types
-- + idempotency marker)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run. Superset of migration 020's CHECK (also (re)adds
-- 'payment_failed'), so running this alone is sufficient.
-- ⚠ Run BEFORE deploying so the renewal_reminder insert isn't rejected.
-- ============================================================

-- 1. Allow the two billing notification types in social_notifications.
ALTER TABLE social_notifications DROP CONSTRAINT IF EXISTS social_notifications_type_ok;

ALTER TABLE social_notifications ADD CONSTRAINT social_notifications_type_ok
  CHECK (type IN (
    'friend_request',
    'notebook_invite',
    'friend_accepted',
    'mention',
    'note_uploaded',
    'payment_failed',
    'renewal_reminder'
  ));

-- 2. Idempotency marker for the daily renewal-reminder worker. Stores the
--    current_period_end value a reminder was already sent for; when the period
--    advances to a new value the row becomes eligible again automatically.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_sent_for_period TIMESTAMPTZ;
