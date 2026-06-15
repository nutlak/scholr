-- ============================================================
-- Migration 014 — Notebook activity (per-message activity log for
-- shared notebooks; powers the Best Friends ranking)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS notebook_activity (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebook_activity_user
  ON notebook_activity (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_activity_notebook
  ON notebook_activity (notebook_id);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE notebook_activity ENABLE ROW LEVEL SECURITY;
