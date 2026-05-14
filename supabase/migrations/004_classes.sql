-- ============================================================
-- Migration 004 — Classes feature (Classes > Units > Notes)
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Classes table (top-level course folder, owned by one user)
CREATE TABLE IF NOT EXISTS classes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#A78BFA',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own classes"
  ON classes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add class_id to notebooks so units belong to a class
--    Nullable so existing notebooks (created before this migration) keep working
ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_class_id ON notebooks(class_id);
