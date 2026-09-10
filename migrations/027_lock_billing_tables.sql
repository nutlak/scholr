-- ============================================================
-- Migration 027 — Lock down billing tables
-- ============================================================
-- subscriptions.tier is what getUserTier() reads to decide whether someone
-- is Pro, and usage.* is what enforces the free-tier limits. Both are written
-- exclusively by the server using the service-role key, which bypasses RLS
-- and table grants. No browser client has any reason to write either one.
--
-- RLS policies for these tables live in the Supabase dashboard rather than in
-- this repo, so rather than depend on their exact contents, this revokes the
-- write privileges outright. A REVOKE holds regardless of how permissive a
-- policy is, so a client cannot grant itself Pro or reset its own usage
-- counters even if a policy would otherwise allow it.
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
