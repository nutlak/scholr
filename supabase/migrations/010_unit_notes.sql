-- ============================================================
-- Migration 010 — Unit notes (member-authored notes per unit)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS unit_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_notes_notebook
  ON unit_notes (notebook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unit_notes_user
  ON unit_notes (user_id);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE unit_notes ENABLE ROW LEVEL SECURITY;
