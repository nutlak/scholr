-- 025_referrals.sql
-- "Invite a friend, get 1 month Pro free." Tracks each referral from invite
-- through signup to reward. Server-only access (service-role), so RLS is on
-- with no public policies (service role bypasses RLS).

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  referred_email    TEXT NOT NULL,
  referred_user_id  UUID REFERENCES auth.users ON DELETE SET NULL,
  status            TEXT DEFAULT 'pending',  -- pending, signed_up, rewarded
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON referrals (lower(referred_email));

-- Referrer attribution + reward bookkeeping on the user's profile.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_months_earned INTEGER DEFAULT 0;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies: service-role only)
