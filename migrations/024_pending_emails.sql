-- 024_pending_emails.sql
-- Scheduled onboarding email queue (welcome / day-3 Feynman / day-7 invite).
-- The Scholr backend enqueues rows on signup and an hourly job sends due ones.
-- This table is written/read only by the server (service-role), so RLS is
-- enabled with NO public policies — that locks it to the service role, which
-- bypasses RLS. (No anon/auth client should ever touch it.)

CREATE TABLE IF NOT EXISTS pending_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT NOT NULL,
  email_type  TEXT NOT NULL,                 -- 'welcome', 'feynman', 'invite_friend'
  send_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  sent        BOOLEAN DEFAULT false,
  sent_at     TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast lookup of due, unsent emails for the hourly worker.
CREATE INDEX IF NOT EXISTS idx_pending_emails_send_at
  ON pending_emails (send_at) WHERE sent = false;

ALTER TABLE pending_emails ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies: service-role only)

-- Honor unsubscribes from the onboarding sequence.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN DEFAULT false;
