-- ============================================================
-- Migration 020 — Allow 'payment_failed' social notifications
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
--
-- Extends the social_notifications type check (migration 018) so the Stripe
-- invoice.payment_failed webhook can push an in-app "update your card" notice.
-- ⚠ Run this BEFORE deploying so the payment_failed insert isn't rejected.
-- ============================================================

ALTER TABLE social_notifications DROP CONSTRAINT IF EXISTS social_notifications_type_ok;

ALTER TABLE social_notifications ADD CONSTRAINT social_notifications_type_ok
  CHECK (type IN (
    'friend_request',
    'notebook_invite',
    'friend_accepted',
    'mention',
    'note_uploaded',
    'payment_failed'
  ));
