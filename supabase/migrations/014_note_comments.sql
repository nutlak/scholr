-- ============================================================
-- Migration 014 — Threaded comments on unit notes
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS note_comments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_note_id UUID        NOT NULL REFERENCES unit_notes(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_comments_note
  ON note_comments (unit_note_id, created_at ASC);

ALTER TABLE note_comments ENABLE ROW LEVEL SECURITY;
