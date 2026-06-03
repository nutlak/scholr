-- 021: add policy-version columns to profiles (extends 020).
-- Records which version of the Terms of Service and Privacy Policy each user
-- accepted at signup, alongside the existing terms_accepted_at timestamp.
-- The server (service-role) writes these; RLS is already enabled on profiles
-- in 020 with no anon/authenticated policies, so these stay server-only.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_version   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_version text;
