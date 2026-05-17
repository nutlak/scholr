-- ============================================================
-- Migration 015 — Due date on notebooks (units)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notebooks_due_date
  ON notebooks (due_date);
