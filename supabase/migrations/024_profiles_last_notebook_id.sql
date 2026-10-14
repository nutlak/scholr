-- 024: which unit someone has open right now.
--
-- This powers "Ana is studying Bio 101 right now" with a Join button on the
-- friends row (commit a69ca9b). The server code has shipped since 2026-09-10,
-- but the column it reads and writes was never added to the database, so that
-- feature has been dark: every heartbeat tried to write it, failed, and retried
-- without it, and every friends list quietly fell back to plain "online".
-- Both paths already handle the column being absent, so running this switches
-- the feature on with no deploy.
--
-- The heartbeat route only stores a unit the person is a member of, and the
-- friends list only ever names a unit the *viewer* also belongs to (so a title
-- you can't open never leaks); presence.test.js pins that rule.
--
-- ON DELETE SET NULL: deleting a unit must not fail because someone had it open.
-- Safe to run more than once. Run it in the Supabase SQL editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_notebook_id UUID REFERENCES notebooks(id) ON DELETE SET NULL;
