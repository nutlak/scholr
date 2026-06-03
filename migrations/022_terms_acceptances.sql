-- 022: append-only consent log.
-- Each row is one acceptance event (Terms + Privacy versions accepted, at a
-- timestamp), so consent history is preserved durably across future policy
-- updates — unlike profiles, which holds only the user's latest acceptance.
-- The server (service-role) inserts a row at signup; RLS is enabled with no
-- anon/authenticated policies, so this stays server-only.

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version    text NOT NULL,
  privacy_version  text NOT NULL,
  accepted_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON terms_acceptances(user_id);

ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
-- Intentionally no anon/authenticated policies: only the service-role server
-- (which bypasses RLS) reads or writes this consent log.
