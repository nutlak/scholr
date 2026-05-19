-- ============================================================
-- Migration 012 — Daily activity log (for study-streak heatmap)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_activity (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE        NOT NULL,
  activity_count INT         DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user
  ON daily_activity (user_id);

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
