-- 034_push_subscriptions.sql
-- Web push subscriptions, for "a friend just started studying" notifications.
-- One row per browser/device (a user can have phone + laptop). Server-only
-- access (service-role), so RLS is on with no public policies.
--
-- push_notify_log throttles pushes to at most one per (notifier, recipient)
-- pair per hour, so opening and closing a notebook a dozen times in a row
-- doesn't spam a friend's phone.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS push_notify_log (
  from_user_id  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  last_sent_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_user_id, to_user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notify_log ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies: service-role only)
