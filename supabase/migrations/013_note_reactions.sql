-- ============================================================
-- Migration 013 — Reactions on unit notes
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE TABLE IF NOT EXISTS note_reactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_note_id UUID        NOT NULL REFERENCES unit_notes(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji        TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_note_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_note_reactions_note
  ON note_reactions (unit_note_id);

ALTER TABLE note_reactions ENABLE ROW LEVEL SECURITY;
