-- ============================================================
-- Migration 016 — Status tag on notebooks (units)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress';

-- Backfill any NULLs from older rows
UPDATE notebooks
  SET status = 'in_progress'
  WHERE status IS NULL OR status = '';

-- Allowed values: 'in_progress' | 'done' | 'need_help'
ALTER TABLE notebooks
  DROP CONSTRAINT IF EXISTS notebooks_status_check;
ALTER TABLE notebooks
  ADD CONSTRAINT notebooks_status_check
  CHECK (status IN ('in_progress', 'done', 'need_help'));
