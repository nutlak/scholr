-- 042: indexes the early core tables never got.
--
-- Postgres indexes a primary key and a UNIQUE constraint, but NOT the columns
-- of a foreign key. So a lookup by a column that isn't the *leading* column of
-- some index scans the whole table. The later migrations (friends, flashcards,
-- notifications, unit notes, images, blocks) added their indexes; these were
-- missed, and they are on the hottest paths:
--
--   notebook_members(user_id)   PK is (notebook_id, user_id), so it can't serve a
--                               lookup by user. Used by the dashboard list
--                               (GET /api/notebooks), the free-plan limit check
--                               (countOwnedNotebooks, on every unit created),
--                               the weekly recap, and account deletion.
--   notes(notebook_id)          FK, no index. Read on every chat message
--                               (buildNotesContext) and counted into every
--                               dashboard/class listing (notes(count)).
--   notes(uploader_id)          FK ON DELETE SET NULL: deleting an account scans
--                               notes to null these out.
--   notebooks(created_by)       Used when deleting an account and by ownership
--                               checks.
--   classes(user_id, sort_order) GET /api/classes: the user's classes, in order.
--
-- And three that were created outside the migrations (the tables exist in
-- production but no migration defines them), so each is guarded:
--
--   daily_activity(user_id, date)      streak heatmap + friends leaderboard
--   user_events(user_id, event_type, created_at)
--                                      the weekly-recap "already sent" check and
--                                      `npm run usage`
--   podcasts(notebook_id)              the unit's podcast list
--   push_subscriptions(user_id)        every push send
--
-- Safe to run more than once. CREATE INDEX takes a brief write lock; at this
-- table size that is milliseconds. Run it in the Supabase SQL editor.
--
-- Honest expectation: with a handful of users nothing is slow yet, so there is
-- nothing to measure today. These keep it that way as the tables grow.

CREATE INDEX IF NOT EXISTS idx_notebook_members_user     ON notebook_members (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_notebook            ON notes (notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_uploader            ON notes (uploader_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_created_by      ON notebooks (created_by);
CREATE INDEX IF NOT EXISTS idx_classes_user_sort         ON classes (user_id, sort_order);

DO $$
BEGIN
  IF to_regclass('public.daily_activity') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity (user_id, date);
  END IF;
  IF to_regclass('public.user_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_events_user_type_created ON user_events (user_id, event_type, created_at DESC);
  END IF;
  IF to_regclass('public.podcasts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_podcasts_notebook ON podcasts (notebook_id);
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
  END IF;
END $$;
