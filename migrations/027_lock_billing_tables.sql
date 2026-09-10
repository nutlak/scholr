-- ============================================================
-- Migration 027 — Lock down billing tables
-- ============================================================
-- subscriptions.tier is what getUserTier() reads to decide whether someone
-- is Pro, and usage.* is what enforces the free-tier limits. Both are written
-- exclusively by the server using the service-role key, which bypasses RLS
-- and table grants. No browser client has any reason to write either one.
--
-- STATUS: verified already enforced in production. Signing in as a throwaway
-- user and attempting to set its own tier to 'pro' returns
-- 42501 permission denied for table subscriptions, as do INSERT and a reset of
-- its own usage counters; that user can read only its own row. So this is NOT
-- an outstanding hole — it codifies the existing state in the repo, where the
-- policies (which live in the Supabase dashboard) otherwise cannot be reviewed.
--
-- Worth running so the guarantee survives a future dashboard change or a
-- project restore, but it is not urgent and changes nothing today.
--
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON TABLE subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE usage         FROM anon, authenticated;

-- Belt and braces: make sure RLS is on, so SELECT is still policy-governed.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage         ENABLE ROW LEVEL SECURITY;

-- Reading your own billing state stays allowed; the app surfaces it through
-- GET /api/user/subscription, but a direct read does no harm.
DROP POLICY IF EXISTS "read own subscription" ON subscriptions;
CREATE POLICY "read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own usage" ON usage;
CREATE POLICY "read own usage"
  ON usage FOR SELECT
  USING (auth.uid() = user_id);
