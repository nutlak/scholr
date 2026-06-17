-- ============================================================
-- Migration 019 — Spaced-repetition flashcards (SM-2)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS flashcards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id   UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front         TEXT        NOT NULL,
  back          TEXT        NOT NULL,
  ease_factor   REAL        DEFAULT 2.5,
  interval_days INT         DEFAULT 0,
  repetitions   INT         DEFAULT 0,
  due_date      DATE        DEFAULT CURRENT_DATE,
  last_reviewed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_user_due
  ON flashcards (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_flashcards_notebook
  ON flashcards (notebook_id);

-- RLS: server uses the service role, so policies aren't strictly required,
-- but enable RLS to lock this table down for any future anon-key access.
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
