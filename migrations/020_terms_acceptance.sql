-- 020: Terms/age consent — record when each user accepted the Terms of Service
-- and Privacy Policy (and affirmed they're 13+) at signup.
--
-- There is no existing user/profile table (accounts live in auth.users), so we
-- add a minimal public.profiles table rather than altering Supabase's managed
-- auth schema. The server writes terms_accepted_at on account creation using the
-- service-role key. RLS is ENABLED with NO anon/authenticated policies, so the
-- public anon client can never read or write this table — only the service-role
-- server (which bypasses RLS) can.

CREATE TABLE IF NOT EXISTS profiles (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_accepted_at timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service-role (server) bypasses RLS; anon and
-- authenticated roles have no access, so this consent column is never exposed
-- through the public anon client.
