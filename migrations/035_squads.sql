-- 035_squads.sql
-- Squad plan: one subscription unlocks Pro for a whole friend group (up to
-- `seats` members), instead of Pro being sold per-person only. Mirrors the
-- personal subscriptions table's shape (stripe_customer_id,
-- stripe_subscription_id, current_period_end) so getUserTier can check both
-- the same way. Server-only access (service-role), so RLS is on with no
-- public policies.

CREATE TABLE IF NOT EXISTS squads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name                    TEXT NOT NULL DEFAULT 'My Squad',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT UNIQUE,
  current_period_end      TIMESTAMP WITH TIME ZONE,
  seats                   INTEGER NOT NULL DEFAULT 5,
  invite_token            UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squads_owner ON squads (owner_id);
CREATE INDEX IF NOT EXISTS idx_squads_stripe_sub ON squads (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_squads_invite_token ON squads (invite_token);

CREATE TABLE IF NOT EXISTS squad_members (
  squad_id   UUID NOT NULL REFERENCES squads ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (squad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members (user_id);

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies: service-role only)
